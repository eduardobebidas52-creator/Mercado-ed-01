/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDbPool } from '../db/connection.js';
import { seedDemoCustomersIfNeeded } from './customers.service.js';

export interface CreditAlertItem {
  debtId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerCpf: string | null;
  creditLimit: number;
  currentDebt: number;
  availableCredit: number;
  isLimitExceeded: boolean;
  saleId: string | null;
  description: string;
  originalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  daysRemainingOrOverdue: number; // Negativo se vencido, positivo se a vencer
  urgency: 'OVERDUE' | 'CRITICAL_7_DAYS' | 'WARNING_30_DAYS' | 'OK';
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  createdAt: string;
}

export interface CreditSummary {
  totalDebtsCount: number;
  totalOpenDebt: number;
  totalOverdueAmount: number;
  overdueCount: number;
  expiring7DaysCount: number;
  expiring30DaysCount: number;
  exceededLimitCount: number;
  delinquentCustomersCount: number;
  delinquencyRate: number; // Porcentagem de inadimplência
}

/**
 * Obtém alertas consolidados de fiado para a Aba Exclusiva "Alerta de Fiado"
 */
export async function getCreditAlerts(filters: {
  status?: 'ALL' | 'OVERDUE' | '7_DAYS' | 'LIMIT_EXCEEDED';
  search?: string;
  customerId?: string;
} = {}): Promise<{
  alerts: CreditAlertItem[];
  summary: CreditSummary;
}> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  await seedDemoCustomersIfNeeded();

  const query = `
    SELECT 
      cd.id AS debt_id,
      cd.sale_id,
      cd.description,
      cd.original_amount,
      cd.paid_amount,
      cd.remaining_amount,
      TO_CHAR(cd.due_date, 'YYYY-MM-DD') AS due_date_str,
      cd.status AS raw_status,
      cd.created_at,
      c.id AS customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.cpf AS customer_cpf,
      c.credit_limit,
      c.current_debt,
      (c.credit_limit - c.current_debt) AS available_credit,
      (cd.due_date - CURRENT_DATE) AS days_diff
    FROM customer_debts cd
    JOIN customers c ON c.id = cd.customer_id
    WHERE cd.remaining_amount > 0
    ORDER BY 
      CASE WHEN cd.due_date < CURRENT_DATE THEN 0 ELSE 1 END,
      cd.due_date ASC,
      cd.remaining_amount DESC;
  `;

  const res = await pool.query(query);

  let totalOpenDebt = 0;
  let totalOverdueAmount = 0;
  let overdueCount = 0;
  let expiring7DaysCount = 0;
  let expiring30DaysCount = 0;
  const delinquentCustomerIds = new Set<string>();

  const allItems: CreditAlertItem[] = res.rows.map(row => {
    const daysDiff = Number(row.days_diff);
    const remaining = Number(row.remaining_amount);
    const limit = Number(row.credit_limit);
    const debt = Number(row.current_debt);
    const isLimitExceeded = debt > limit;

    totalOpenDebt += remaining;

    let urgency: 'OVERDUE' | 'CRITICAL_7_DAYS' | 'WARNING_30_DAYS' | 'OK';
    let status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

    if (daysDiff < 0) {
      urgency = 'OVERDUE';
      status = 'OVERDUE';
      overdueCount++;
      totalOverdueAmount += remaining;
      delinquentCustomerIds.add(row.customer_id);
    } else if (daysDiff <= 7) {
      urgency = 'CRITICAL_7_DAYS';
      status = Number(row.paid_amount) > 0 ? 'PARTIALLY_PAID' : 'PENDING';
      expiring7DaysCount++;
    } else if (daysDiff <= 30) {
      urgency = 'WARNING_30_DAYS';
      status = Number(row.paid_amount) > 0 ? 'PARTIALLY_PAID' : 'PENDING';
      expiring30DaysCount++;
    } else {
      urgency = 'OK';
      status = Number(row.paid_amount) > 0 ? 'PARTIALLY_PAID' : 'PENDING';
    }

    return {
      debtId: row.debt_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerCpf: row.customer_cpf,
      creditLimit: limit,
      currentDebt: debt,
      availableCredit: Number((limit - debt).toFixed(2)),
      isLimitExceeded,
      saleId: row.sale_id,
      description: row.description,
      originalAmount: Number(row.original_amount),
      paidAmount: Number(row.paid_amount),
      remainingAmount: remaining,
      dueDate: row.due_date_str,
      daysRemainingOrOverdue: daysDiff,
      urgency,
      status,
      createdAt: row.created_at,
    };
  });

  // Clientes com limite ultrapassado
  const limitRes = await pool.query(
    'SELECT COUNT(*) FROM customers WHERE current_debt > credit_limit;'
  );
  const exceededLimitCount = Number(limitRes.rows[0]?.count || 0);

  // Filtragem
  let filtered = allItems;

  if (filters.customerId) {
    filtered = filtered.filter(item => item.customerId === filters.customerId);
  }

  if (filters.search && filters.search.trim()) {
    const s = filters.search.toLowerCase().trim();
    filtered = filtered.filter(item => 
      item.customerName.toLowerCase().includes(s) ||
      item.customerPhone.includes(s) ||
      (item.customerCpf && item.customerCpf.includes(s)) ||
      item.description.toLowerCase().includes(s)
    );
  }

  if (filters.status === 'OVERDUE') {
    filtered = filtered.filter(item => item.urgency === 'OVERDUE');
  } else if (filters.status === '7_DAYS') {
    filtered = filtered.filter(item => item.urgency === 'CRITICAL_7_DAYS');
  } else if (filters.status === 'LIMIT_EXCEEDED') {
    filtered = filtered.filter(item => item.isLimitExceeded);
  }

  const delinquencyRate = totalOpenDebt > 0 
    ? Number(((totalOverdueAmount / totalOpenDebt) * 100).toFixed(1))
    : 0;

  return {
    alerts: filtered,
    summary: {
      totalDebtsCount: allItems.length,
      totalOpenDebt: Number(totalOpenDebt.toFixed(2)),
      totalOverdueAmount: Number(totalOverdueAmount.toFixed(2)),
      overdueCount,
      expiring7DaysCount,
      expiring30DaysCount,
      exceededLimitCount,
      delinquentCustomersCount: delinquentCustomerIds.size,
      delinquencyRate,
    },
  };
}

/**
 * Contadores rápidos para Badge do Menu e Cards do Dashboard
 */
export async function getCreditAlertCounts(): Promise<{
  overdueCount: number;
  expiring7DaysCount: number;
  exceededLimitCount: number;
  totalCreditAlerts: number;
  totalOpenDebt: number;
  totalOverdueAmount: number;
}> {
  const pool = getDbPool();
  if (!pool) {
    return {
      overdueCount: 0,
      expiring7DaysCount: 0,
      exceededLimitCount: 0,
      totalCreditAlerts: 0,
      totalOpenDebt: 0,
      totalOverdueAmount: 0,
    };
  }

  try {
    const [overdueRes, exp7Res, limitRes, sumRes] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) AS count, COALESCE(SUM(remaining_amount), 0) AS amount
        FROM customer_debts
        WHERE remaining_amount > 0 AND due_date < CURRENT_DATE;
      `),
      pool.query(`
        SELECT COUNT(*) AS count
        FROM customer_debts
        WHERE remaining_amount > 0 AND due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + INTERVAL '7 days';
      `),
      pool.query(`
        SELECT COUNT(*) AS count
        FROM customers
        WHERE current_debt > credit_limit;
      `),
      pool.query(`
        SELECT COALESCE(SUM(remaining_amount), 0) AS total_debt
        FROM customer_debts
        WHERE remaining_amount > 0;
      `),
    ]);

    const overdueCount = Number(overdueRes.rows[0]?.count || 0);
    const expiring7DaysCount = Number(exp7Res.rows[0]?.count || 0);
    const exceededLimitCount = Number(limitRes.rows[0]?.count || 0);
    const totalOverdueAmount = Number(overdueRes.rows[0]?.amount || 0);
    const totalOpenDebt = Number(sumRes.rows[0]?.total_debt || 0);

    return {
      overdueCount,
      expiring7DaysCount,
      exceededLimitCount,
      totalCreditAlerts: overdueCount + expiring7DaysCount + exceededLimitCount,
      totalOpenDebt: Number(totalOpenDebt.toFixed(2)),
      totalOverdueAmount: Number(totalOverdueAmount.toFixed(2)),
    };
  } catch {
    return {
      overdueCount: 0,
      expiring7DaysCount: 0,
      exceededLimitCount: 0,
      totalCreditAlerts: 0,
      totalOpenDebt: 0,
      totalOverdueAmount: 0,
    };
  }
}

/**
 * Lista todas as contas de fiado com histórico e filtros para a aba "Fiado e Recebimentos"
 */
export async function listDebts(filters: {
  status?: string;
  customerId?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const conditions: string[] = ['1=1'];
  const params: any[] = [];
  let pIdx = 1;

  if (filters.customerId) {
    conditions.push(`cd.customer_id = $${pIdx}`);
    params.push(filters.customerId);
    pIdx++;
  }

  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(`(c.name ILIKE $${pIdx} OR c.phone ILIKE $${pIdx} OR cd.description ILIKE $${pIdx})`);
    params.push(q);
    pIdx++;
  }

  if (filters.status) {
    if (filters.status === 'PENDING') {
      conditions.push(`cd.remaining_amount > 0 AND cd.due_date >= CURRENT_DATE`);
    } else if (filters.status === 'OVERDUE') {
      conditions.push(`cd.remaining_amount > 0 AND cd.due_date < CURRENT_DATE`);
    } else if (filters.status === 'PAID') {
      conditions.push(`cd.remaining_amount = 0`);
    }
  }

  const where = conditions.join(' AND ');
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
  const offset = Math.max(0, Number(filters.offset) || 0);

  const query = `
    SELECT 
      cd.*,
      TO_CHAR(cd.due_date, 'YYYY-MM-DD') AS due_date_str,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.credit_limit,
      c.current_debt,
      CASE 
        WHEN cd.remaining_amount <= 0 THEN 'PAID'
        WHEN cd.due_date < CURRENT_DATE THEN 'OVERDUE'
        WHEN cd.paid_amount > 0 THEN 'PARTIALLY_PAID'
        ELSE 'PENDING'
      END AS computed_status,
      CURRENT_DATE - cd.due_date AS days_overdue
    FROM customer_debts cd
    JOIN customers c ON c.id = cd.customer_id
    WHERE ${where}
    ORDER BY cd.created_at DESC
    LIMIT $${pIdx} OFFSET $${pIdx + 1};
  `;

  params.push(limit, offset);

  const [resList, resCount] = await Promise.all([
    pool.query(query, params),
    pool.query(`SELECT COUNT(*) FROM customer_debts cd JOIN customers c ON c.id = cd.customer_id WHERE ${where};`, params.slice(0, pIdx - 1))
  ]);

  return {
    debts: resList.rows.map(d => ({
      id: d.id,
      customerId: d.customer_id,
      customerName: d.customer_name,
      customerPhone: d.customer_phone,
      creditLimit: Number(d.credit_limit),
      currentDebt: Number(d.current_debt),
      saleId: d.sale_id,
      description: d.description,
      originalAmount: Number(d.original_amount),
      paidAmount: Number(d.paid_amount),
      remainingAmount: Number(d.remaining_amount),
      dueDate: d.due_date_str,
      status: d.computed_status,
      daysOverdue: Number(d.days_overdue || 0),
      notes: d.notes,
      createdAt: d.created_at,
    })),
    total: Number(resCount.rows[0]?.count || 0),
  };
}

/**
 * Realiza a baixa de pagamento de fiado (parcial ou total) com emissão de recibo e integração de caixa
 */
export async function receiveDebtPayment(data: {
  customerId: string;
  debtId?: string; // Se fornecido, abate dessa dívida específica; se não, abate da mais antiga
  amount: number;
  paymentMethod: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO';
  operatorId: string;
  notes?: string;
}): Promise<{
  paymentId: string;
  receiptNumber: number;
  customerName: string;
  customerPhone: string;
  amount: number;
  paymentMethod: string;
  previousDebt: number;
  remainingDebt: number;
  operatorName: string;
  createdAt: string;
}> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const paymentAmount = Number(data.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new Error('Valor do pagamento deve ser maior que zero.');
    }

    // 1. Busca e bloqueia o cliente para concorrência
    const custRes = await client.query(
      'SELECT id, name, phone, current_debt FROM customers WHERE id = $1 FOR UPDATE;',
      [data.customerId]
    );

    if (custRes.rows.length === 0) {
      throw new Error('Cliente não encontrado.');
    }

    const customer = custRes.rows[0];
    const previousDebt = Number(customer.current_debt);

    if (previousDebt <= 0) {
      throw new Error(`O cliente ${customer.name} não possui saldo devedor em aberto.`);
    }

    // Calcula novo saldo
    const remainingDebt = Math.max(0, Number((previousDebt - paymentAmount).toFixed(2)));

    // 2. Abate das dívidas (específica ou em cascata nas mais antigas)
    let leftToDeduct = paymentAmount;

    if (data.debtId) {
      const dRes = await client.query(
        'SELECT id, remaining_amount, paid_amount FROM customer_debts WHERE id = $1 AND customer_id = $2 FOR UPDATE;',
        [data.debtId, data.customerId]
      );
      if (dRes.rows.length > 0) {
        const debt = dRes.rows[0];
        const rem = Number(debt.remaining_amount);
        const paid = Number(debt.paid_amount);
        const deduct = Math.min(rem, leftToDeduct);
        const newRem = Number((rem - deduct).toFixed(2));
        const newPaid = Number((paid + deduct).toFixed(2));
        const newStatus = newRem <= 0 ? 'PAID' : 'PARTIALLY_PAID';

        await client.query(
          `UPDATE customer_debts 
           SET remaining_amount = $1, paid_amount = $2, status = $3, updated_at = NOW()
           WHERE id = $4;`,
          [newRem, newPaid, newStatus, data.debtId]
        );
        leftToDeduct -= deduct;
      }
    }

    // Se ainda restou valor para abater (ou se não passou debtId), abate das mais antigas
    if (leftToDeduct > 0) {
      const openDebts = await client.query(
        `SELECT id, remaining_amount, paid_amount 
         FROM customer_debts 
         WHERE customer_id = $1 AND remaining_amount > 0 
         ORDER BY due_date ASC, created_at ASC 
         FOR UPDATE;`,
        [data.customerId]
      );

      for (const d of openDebts.rows) {
        if (leftToDeduct <= 0) break;
        const rem = Number(d.remaining_amount);
        const paid = Number(d.paid_amount);
        const deduct = Math.min(rem, leftToDeduct);
        const newRem = Number((rem - deduct).toFixed(2));
        const newPaid = Number((paid + deduct).toFixed(2));
        const newStatus = newRem <= 0 ? 'PAID' : 'PARTIALLY_PAID';

        await client.query(
          `UPDATE customer_debts 
           SET remaining_amount = $1, paid_amount = $2, status = $3, updated_at = NOW()
           WHERE id = $4;`,
          [newRem, newPaid, newStatus, d.id]
        );

        leftToDeduct = Number((leftToDeduct - deduct).toFixed(2));
      }
    }

    // 3. Atualiza o saldo do cliente
    await client.query(
      `UPDATE customers 
       SET current_debt = $1, updated_at = NOW() 
       WHERE id = $2;`,
      [remainingDebt, data.customerId]
    );

    // 4. Verifica se o operador tem um caixa aberto para registrar a entrada de dinheiro no turno
    const regRes = await client.query(
      `SELECT id FROM cash_registers WHERE operator_id = $1 AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1;`,
      [data.operatorId]
    );
    const cashRegisterId = regRes.rows[0]?.id || null;

    // 5. Registra o pagamento na tabela debt_payments
    const payRes = await client.query(
      `INSERT INTO debt_payments (
        customer_id, debt_id, cash_register_id, operator_id, amount,
        payment_method, previous_debt, remaining_debt, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, receipt_number, created_at;`,
      [
        data.customerId,
        data.debtId || null,
        cashRegisterId,
        data.operatorId,
        paymentAmount,
        data.paymentMethod,
        previousDebt,
        remainingDebt,
        data.notes?.trim() || null,
      ]
    );

    const payment = payRes.rows[0];

    // Se houver caixa aberto e o pagamento for em dinheiro ou pix balcão, adiciona transação de suprimento
    if (cashRegisterId && data.paymentMethod === 'DINHEIRO') {
      await client.query(
        `INSERT INTO cash_transactions (cash_register_id, type, amount, reason, operator_id)
         VALUES ($1, 'SUPRIMENTO', $2, $3, $4);`,
        [
          cashRegisterId,
          paymentAmount,
          `Recebimento de Fiado - Cliente: ${customer.name} (Recibo #${payment.receipt_number})`,
          data.operatorId,
        ]
      );
    }

    // Busca nome do operador
    const opRes = await client.query('SELECT name FROM users WHERE id = $1;', [data.operatorId]);
    const operatorName = opRes.rows[0]?.name || 'Operador de Caixa';

    await client.query('COMMIT');

    return {
      paymentId: payment.id,
      receiptNumber: payment.receipt_number,
      customerName: customer.name,
      customerPhone: customer.phone,
      amount: paymentAmount,
      paymentMethod: data.paymentMethod,
      previousDebt,
      remainingDebt,
      operatorName,
      createdAt: payment.created_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Busca histórico de recibos emitidos
 */
export async function listPaymentReceipts(filters: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const conditions: string[] = ['1=1'];
  const params: any[] = [];
  let pIdx = 1;

  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(`(c.name ILIKE $${pIdx} OR c.phone ILIKE $${pIdx} OR u.name ILIKE $${pIdx})`);
    params.push(q);
    pIdx++;
  }

  const where = conditions.join(' AND ');
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 50));
  const offset = Math.max(0, Number(filters.offset) || 0);

  const query = `
    SELECT 
      dp.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      u.name AS operator_name
    FROM debt_payments dp
    JOIN customers c ON c.id = dp.customer_id
    JOIN users u ON u.id = dp.operator_id
    WHERE ${where}
    ORDER BY dp.created_at DESC
    LIMIT $${pIdx} OFFSET $${pIdx + 1};
  `;

  params.push(limit, offset);

  const [resList, resCount] = await Promise.all([
    pool.query(query, params),
    pool.query(`SELECT COUNT(*) FROM debt_payments dp JOIN customers c ON c.id = dp.customer_id JOIN users u ON u.id = dp.operator_id WHERE ${where};`, params.slice(0, pIdx - 1))
  ]);

  return {
    receipts: resList.rows.map(r => ({
      id: r.id,
      receiptNumber: r.receipt_number,
      customerId: r.customer_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      amount: Number(r.amount),
      paymentMethod: r.payment_method,
      previousDebt: Number(r.previous_debt),
      remainingDebt: Number(r.remaining_debt),
      operatorName: r.operator_name,
      notes: r.notes,
      createdAt: r.created_at,
    })),
    total: Number(resCount.rows[0]?.count || 0),
  };
}
