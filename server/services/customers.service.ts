/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDbPool } from '../db/connection.js';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  address: string | null;
  creditLimit: number;
  currentDebt: number;
  status: 'ACTIVE' | 'BLOCKED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Métricas calculadas
  totalPurchasesCount?: number;
  totalPurchasesAmount?: number;
  totalDebtsCount?: number;
  openDebtsCount?: number;
  overdueDebtsCount?: number;
  availableCredit?: number;
}

export interface CustomerFilters {
  search?: string;
  status?: string;
  hasDebtOnly?: boolean;
  overdueOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Mapeia registro do banco para Customer
 */
function mapCustomerRow(row: any): Customer {
  const creditLimit = Number(row.credit_limit || 0);
  const currentDebt = Number(row.current_debt || 0);
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    cpf: row.cpf,
    address: row.address,
    creditLimit,
    currentDebt,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalPurchasesCount: row.total_purchases_count !== undefined ? Number(row.total_purchases_count) : undefined,
    totalPurchasesAmount: row.total_purchases_amount !== undefined ? Number(row.total_purchases_amount) : undefined,
    totalDebtsCount: row.total_debts_count !== undefined ? Number(row.total_debts_count) : undefined,
    openDebtsCount: row.open_debts_count !== undefined ? Number(row.open_debts_count) : undefined,
    overdueDebtsCount: row.overdue_debts_count !== undefined ? Number(row.overdue_debts_count) : undefined,
    availableCredit: Number(Math.max(0, creditLimit - currentDebt).toFixed(2)),
  };
}

/**
 * Lista clientes com suporte a filtros, paginação e indicadores de fiado
 */
export async function listCustomers(filters: CustomerFilters = {}): Promise<{
  customers: Customer[];
  total: number;
  summary: {
    totalCustomers: number;
    activeCustomers: number;
    blockedCustomers: number;
    customersWithDebt: number;
    totalDebt: number;
    totalCreditLimit: number;
  };
}> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  await seedDemoCustomersIfNeeded();

  const conditions: string[] = ['1=1'];
  const params: any[] = [];
  let paramIdx = 1;

  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(`(c.name ILIKE $${paramIdx} OR c.phone ILIKE $${paramIdx} OR c.cpf ILIKE $${paramIdx})`);
    params.push(q);
    paramIdx++;
  }

  if (filters.status) {
    conditions.push(`c.status = $${paramIdx}`);
    params.push(filters.status);
    paramIdx++;
  }

  if (filters.hasDebtOnly) {
    conditions.push(`c.current_debt > 0`);
  }

  if (filters.overdueOnly) {
    conditions.push(`EXISTS (
      SELECT 1 FROM customer_debts cd
      WHERE cd.customer_id = c.id
        AND cd.remaining_amount > 0
        AND cd.due_date < CURRENT_DATE
    )`);
  }

  const whereClause = conditions.join(' AND ');

  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
  const offset = Math.max(0, Number(filters.offset) || 0);

  const query = `
    SELECT 
      c.*,
      COUNT(DISTINCT s.id) AS total_purchases_count,
      COALESCE(SUM(s.total), 0) AS total_purchases_amount,
      COUNT(DISTINCT cd.id) FILTER (WHERE cd.remaining_amount > 0) AS open_debts_count,
      COUNT(DISTINCT cd.id) FILTER (WHERE cd.remaining_amount > 0 AND cd.due_date < CURRENT_DATE) AS overdue_debts_count
    FROM customers c
    LEFT JOIN sales s ON s.customer_id = c.id AND s.status = 'COMPLETED'
    LEFT JOIN customer_debts cd ON cd.customer_id = c.id
    WHERE ${whereClause}
    GROUP BY c.id
    ORDER BY c.current_debt DESC, c.name ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
  `;

  params.push(limit, offset);

  const [resList, resCount, resSummary] = await Promise.all([
    pool.query(query, params),
    pool.query(`SELECT COUNT(*) FROM customers c WHERE ${whereClause};`, params.slice(0, paramIdx - 1)),
    pool.query(`
      SELECT 
        COUNT(*) AS total_customers,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_customers,
        COUNT(*) FILTER (WHERE status = 'BLOCKED') AS blocked_customers,
        COUNT(*) FILTER (WHERE current_debt > 0) AS customers_with_debt,
        COALESCE(SUM(current_debt), 0) AS total_debt,
        COALESCE(SUM(credit_limit), 0) AS total_credit_limit
      FROM customers;
    `),
  ]);

  const customers = resList.rows.map(mapCustomerRow);
  const total = Number(resCount.rows[0]?.count || 0);
  const sumRow = resSummary.rows[0];

  return {
    customers,
    total,
    summary: {
      totalCustomers: Number(sumRow.total_customers || 0),
      activeCustomers: Number(sumRow.active_customers || 0),
      blockedCustomers: Number(sumRow.blocked_customers || 0),
      customersWithDebt: Number(sumRow.customers_with_debt || 0),
      totalDebt: Number(sumRow.total_debt || 0),
      totalCreditLimit: Number(sumRow.total_credit_limit || 0),
    },
  };
}

/**
 * Obtém cliente por ID com ficha completa (histórico de compras, dívidas e pagamentos)
 */
export async function getCustomerById(id: string): Promise<{
  customer: Customer;
  debts: any[];
  payments: any[];
  recentSales: any[];
} | null> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const res = await pool.query('SELECT * FROM customers WHERE id = $1;', [id]);
  if (res.rows.length === 0) return null;

  const customer = mapCustomerRow(res.rows[0]);

  // Busca dívidas
  const debtsRes = await pool.query(
    `SELECT 
      cd.*,
      CASE 
        WHEN cd.remaining_amount <= 0 THEN 'PAID'
        WHEN cd.due_date < CURRENT_DATE THEN 'OVERDUE'
        WHEN cd.paid_amount > 0 THEN 'PARTIALLY_PAID'
        ELSE 'PENDING'
      END AS computed_status,
      CURRENT_DATE - cd.due_date AS days_overdue
     FROM customer_debts cd
     WHERE cd.customer_id = $1
     ORDER BY cd.due_date ASC, cd.created_at DESC;`,
    [id]
  );

  // Busca pagamentos / recibos
  const paymentsRes = await pool.query(
    `SELECT 
      dp.*,
      u.name AS operator_name
     FROM debt_payments dp
     JOIN users u ON u.id = dp.operator_id
     WHERE dp.customer_id = $1
     ORDER BY dp.created_at DESC;`,
    [id]
  );

  // Busca vendas
  const salesRes = await pool.query(
    `SELECT 
      s.id, s.sale_number, s.subtotal, s.discount, s.total, s.payment_method, s.created_at
     FROM sales s
     WHERE s.customer_id = $1
     ORDER BY s.created_at DESC
     LIMIT 20;`,
    [id]
  );

  return {
    customer,
    debts: debtsRes.rows.map(d => ({
      id: d.id,
      saleId: d.sale_id,
      description: d.description,
      originalAmount: Number(d.original_amount),
      paidAmount: Number(d.paid_amount),
      remainingAmount: Number(d.remaining_amount),
      dueDate: d.due_date,
      status: d.computed_status,
      daysOverdue: Number(d.days_overdue || 0),
      notes: d.notes,
      createdAt: d.created_at,
    })),
    payments: paymentsRes.rows.map(p => ({
      id: p.id,
      receiptNumber: p.receipt_number,
      amount: Number(p.amount),
      paymentMethod: p.payment_method,
      previousDebt: Number(p.previous_debt),
      remainingDebt: Number(p.remaining_debt),
      operatorName: p.operator_name,
      notes: p.notes,
      createdAt: p.created_at,
    })),
    recentSales: salesRes.rows.map(s => ({
      id: s.id,
      saleNumber: s.sale_number,
      total: Number(s.total),
      paymentMethod: s.payment_method,
      createdAt: s.created_at,
    })),
  };
}

/**
 * Cadastra novo cliente
 */
export async function createCustomer(data: {
  name: string;
  phone: string;
  cpf?: string;
  address?: string;
  creditLimit?: number;
  status?: 'ACTIVE' | 'BLOCKED';
  notes?: string;
}): Promise<Customer> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  if (!data.name || !data.name.trim()) throw new Error('Nome do cliente é obrigatório.');
  if (!data.phone || !data.phone.trim()) throw new Error('Telefone do cliente é obrigatório.');

  const limit = Math.max(0, Number(data.creditLimit) || 500);

  const res = await pool.query(
    `INSERT INTO customers (name, phone, cpf, address, credit_limit, current_debt, status, notes)
     VALUES ($1, $2, $3, $4, $5, 0.00, $6, $7)
     RETURNING *;`,
    [
      data.name.trim(),
      data.phone.trim(),
      data.cpf?.trim() || null,
      data.address?.trim() || null,
      limit,
      data.status || 'ACTIVE',
      data.notes?.trim() || null,
    ]
  );

  return mapCustomerRow(res.rows[0]);
}

/**
 * Atualiza dados do cliente
 */
export async function updateCustomer(
  id: string,
  data: {
    name?: string;
    phone?: string;
    cpf?: string | null;
    address?: string | null;
    creditLimit?: number;
    status?: 'ACTIVE' | 'BLOCKED';
    notes?: string | null;
  }
): Promise<Customer> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const existing = await pool.query('SELECT * FROM customers WHERE id = $1;', [id]);
  if (existing.rows.length === 0) throw new Error('Cliente não encontrado.');

  const current = existing.rows[0];

  const name = data.name !== undefined ? data.name.trim() : current.name;
  const phone = data.phone !== undefined ? data.phone.trim() : current.phone;
  const cpf = data.cpf !== undefined ? (data.cpf?.trim() || null) : current.cpf;
  const address = data.address !== undefined ? (data.address?.trim() || null) : current.address;
  const creditLimit = data.creditLimit !== undefined ? Math.max(0, Number(data.creditLimit)) : Number(current.credit_limit);
  const status = data.status !== undefined ? data.status : current.status;
  const notes = data.notes !== undefined ? (data.notes?.trim() || null) : current.notes;

  const res = await pool.query(
    `UPDATE customers
     SET name = $1, phone = $2, cpf = $3, address = $4, credit_limit = $5, status = $6, notes = $7, updated_at = NOW()
     WHERE id = $8
     RETURNING *;`,
    [name, phone, cpf, address, creditLimit, status, notes, id]
  );

  return mapCustomerRow(res.rows[0]);
}

/**
 * Exclui cliente se não possuir saldo devedor
 */
export async function deleteCustomer(id: string): Promise<void> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const existing = await pool.query('SELECT current_debt FROM customers WHERE id = $1;', [id]);
  if (existing.rows.length === 0) throw new Error('Cliente não encontrado.');

  const debt = Number(existing.rows[0].current_debt || 0);
  if (debt > 0) {
    throw new Error(`Não é possível excluir o cliente pois ele possui saldo devedor em aberto de R$ ${debt.toFixed(2)}.`);
  }

  await pool.query('DELETE FROM customers WHERE id = $1;', [id]);
}

/**
 * Popula clientes de demonstração com fiados e alertas reais se a tabela estiver vazia
 */
export async function seedDemoCustomersIfNeeded(): Promise<void> {
  const pool = getDbPool();
  if (!pool) return;

  const check = await pool.query('SELECT COUNT(*) FROM customers;');
  if (Number(check.rows[0]?.count || 0) > 0) return;

  // Busca um operador admin para vincular pagamentos
  const userRes = await pool.query("SELECT id FROM users ORDER BY created_at ASC LIMIT 1;");
  const operatorId = userRes.rows[0]?.id;

  const demoList = [
    {
      name: 'Maria de Fátima Oliveira',
      phone: '(11) 98765-4321',
      cpf: '123.456.789-00',
      address: 'Rua das Flores, 142 - Bairro Centro',
      creditLimit: 600.00,
      currentDebt: 185.50,
      status: 'ACTIVE',
      notes: 'Cliente antiga, costuma pagar no quinto dia útil.',
      debts: [
        {
          desc: 'Rancho do mês (Arroz, Feijão, Óleo, Café)',
          amount: 185.50,
          remaining: 185.50,
          dueDateOffsetDays: 4, // Vence em 4 dias (Alerta Laranja / 7 dias)
        }
      ]
    },
    {
      name: 'João Carlos da Silva',
      phone: '(11) 97654-3210',
      cpf: '234.567.890-11',
      address: 'Av. Brasil, 850 - Apto 32',
      creditLimit: 500.00,
      currentDebt: 340.00,
      status: 'ACTIVE',
      notes: 'Trabalha no comércio vizinho.',
      debts: [
        {
          desc: 'Compras semanais + Bebidas',
          amount: 340.00,
          remaining: 340.00,
          dueDateOffsetDays: -12, // Vencido há 12 dias (Alerta Vermelho Crítico)
        }
      ]
    },
    {
      name: 'Carlos Eduardo Santos',
      phone: '(11) 95432-1098',
      cpf: '456.789.012-33',
      address: 'Travessa dos Pássaros, 45',
      creditLimit: 300.00,
      currentDebt: 320.00, // Limite Ultrapassado!
      status: 'BLOCKED',
      notes: 'Limite estourado. Bloqueado para novos fiados até quitação.',
      debts: [
        {
          desc: 'Fardo de Refrigerante e Açúcar',
          amount: 320.00,
          remaining: 320.00,
          dueDateOffsetDays: -25, // Vencido há 25 dias
        }
      ]
    },
    {
      name: 'Ana Paula Ferreira',
      phone: '(11) 96543-2109',
      cpf: '345.678.901-22',
      address: 'Rua Paraná, 510',
      creditLimit: 800.00,
      currentDebt: 0.00,
      status: 'ACTIVE',
      notes: 'Cliente nota 10, sempre quita com antecedência.',
      debts: []
    },
    {
      name: 'Luciana Ribeiro de Almeida',
      phone: '(11) 94321-0987',
      cpf: '567.890.123-44',
      address: 'Rua São Paulo, 1200',
      creditLimit: 700.00,
      currentDebt: 85.00,
      status: 'ACTIVE',
      notes: 'Compras de padaria e laticínios.',
      debts: [
        {
          desc: 'Padaria, Frios e Leite',
          amount: 85.00,
          remaining: 85.00,
          dueDateOffsetDays: 18, // Vence em 18 dias
        }
      ]
    }
  ];

  for (const c of demoList) {
    const res = await pool.query(
      `INSERT INTO customers (name, phone, cpf, address, credit_limit, current_debt, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id;`,
      [c.name, c.phone, c.cpf, c.address, c.creditLimit, c.currentDebt, c.status, c.notes]
    );

    const custId = res.rows[0].id;

    for (const d of c.debts) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + d.dueDateOffsetDays);
      const dueDateStr = dueDate.toISOString().split('T')[0];
      const status = d.dueDateOffsetDays < 0 ? 'OVERDUE' : 'PENDING';

      await pool.query(
        `INSERT INTO customer_debts (customer_id, description, original_amount, paid_amount, remaining_amount, due_date, status)
         VALUES ($1, $2, $3, 0.00, $4, $5, $6);`,
        [custId, d.desc, d.amount, d.remaining, dueDateStr, status]
      );
    }
  }
}
