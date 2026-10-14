/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDbPool } from '../db/connection.js';

export interface CashRegister {
  id: string;
  operatorId: string;
  operatorName?: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number | null;
  expectedBalance: number | null;
  difference: number | null;
  status: 'OPEN' | 'CLOSED';
  notes: string | null;
  createdAt: string;
}

export interface CashTransaction {
  id: string;
  cashRegisterId: string;
  type: 'SUPRIMENTO' | 'SANGRIA';
  amount: number;
  reason: string;
  operatorId: string;
  operatorName?: string;
  createdAt: string;
}

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  barcode: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  totalPrice: number;
}

export interface Sale {
  id: string;
  saleNumber: number;
  cashRegisterId: string | null;
  operatorId: string;
  operatorName?: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'FIADO';
  amountPaid: number;
  changeAmount: number;
  customerName: string | null;
  status: 'COMPLETED' | 'CANCELLED';
  cancellationReason: string | null;
  createdAt: string;
  items?: SaleItem[];
}

export interface TodaySalesMetrics {
  totalSalesCount: number;
  totalRevenue: number;
  estimatedProfit: number;
  byPaymentMethod: {
    dinheiro: number;
    pix: number;
    debito: number;
    credito: number;
    fiado: number;
  };
}

/**
 * Consulta o turno de caixa aberto atualmente para o operador
 */
export async function getCurrentCashRegister(operatorId?: string): Promise<CashRegister | null> {
  const pool = getDbPool();
  if (!pool) return null;

  let query = `
    SELECT cr.*, u.name AS operator_name
    FROM cash_registers cr
    JOIN users u ON cr.operator_id = u.id
    WHERE cr.status = 'OPEN'
  `;
  const params: unknown[] = [];

  if (operatorId) {
    query += ' AND cr.operator_id = $1';
    params.push(operatorId);
  }

  query += ' ORDER BY cr.opened_at DESC LIMIT 1;';

  const res = await pool.query(query, params);
  if (res.rows.length === 0) return null;

  const r = res.rows[0];
  return {
    id: r.id,
    operatorId: r.operator_id,
    operatorName: r.operator_name,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    openingBalance: Number(r.opening_balance || 0),
    closingBalance: r.closing_balance !== null ? Number(r.closing_balance) : null,
    expectedBalance: r.expected_balance !== null ? Number(r.expected_balance) : null,
    difference: r.difference !== null ? Number(r.difference) : null,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

/**
 * Abre um novo turno de caixa com saldo inicial (fundo de troco)
 */
export async function openCashRegister(
  operatorId: string,
  initialBalance: number,
  notes?: string
): Promise<CashRegister> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  // Verifica se já existe caixa aberto para esse operador
  const existing = await getCurrentCashRegister(operatorId);
  if (existing) {
    throw new Error('Você já possui um caixa aberto ativo.');
  }

  const safeBalance = Math.max(0, Number(initialBalance) || 0);

  const res = await pool.query(
    `INSERT INTO cash_registers (operator_id, opening_balance, notes, status)
     VALUES ($1, $2, $3, 'OPEN')
     RETURNING *;`,
    [operatorId, safeBalance, notes?.trim() || null]
  );

  const r = res.rows[0];
  return {
    id: r.id,
    operatorId: r.operator_id,
    openedAt: r.opened_at,
    closedAt: null,
    openingBalance: Number(r.opening_balance),
    closingBalance: null,
    expectedBalance: null,
    difference: null,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

/**
 * Adiciona movimentação avulsa de caixa (Suprimento ou Sangria)
 */
export async function addCashTransaction(
  registerId: string,
  operatorId: string,
  type: 'SUPRIMENTO' | 'SANGRIA',
  amount: number,
  reason: string
): Promise<CashTransaction> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const safeAmount = Number(amount);
  if (isNaN(safeAmount) || safeAmount <= 0) {
    throw new Error('O valor da movimentação deve ser maior que zero.');
  }

  const safeReason = (reason || '').trim();
  if (!safeReason) {
    throw new Error('Informe o motivo da sangria ou suprimento.');
  }

  const res = await pool.query(
    `INSERT INTO cash_transactions (cash_register_id, operator_id, type, amount, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *;`,
    [registerId, operatorId, type, safeAmount, safeReason]
  );

  const r = res.rows[0];
  return {
    id: r.id,
    cashRegisterId: r.cash_register_id,
    type: r.type,
    amount: Number(r.amount),
    reason: r.reason,
    operatorId: r.operator_id,
    createdAt: r.created_at,
  };
}

/**
 * Fecha o caixa e calcula o saldo esperado vs saldo contado
 */
export async function closeCashRegister(
  registerId: string,
  operatorId: string,
  countedBalance: number,
  notes?: string
): Promise<CashRegister> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Busca o caixa
    const regRes = await client.query('SELECT * FROM cash_registers WHERE id = $1 FOR UPDATE;', [registerId]);
    if (regRes.rows.length === 0) throw new Error('Caixa não encontrado.');
    const reg = regRes.rows[0];
    if (reg.status === 'CLOSED') throw new Error('Este caixa já foi fechado anteriormente.');

    // Calcula total de vendas em dinheiro desse caixa
    const salesRes = await client.query<{ total_dinheiro: string }>(
      `SELECT COALESCE(SUM(total), 0) AS total_dinheiro
       FROM sales
       WHERE cash_register_id = $1 AND payment_method = 'DINHEIRO' AND status = 'COMPLETED';`,
      [registerId]
    );
    const totalDinheiroVendas = Number(salesRes.rows[0].total_dinheiro || 0);

    // Calcula suprimentos e sangrias
    const transRes = await client.query<{
      suprimentos: string;
      sangrias: string;
    }>(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'SUPRIMENTO' THEN amount ELSE 0 END), 0) AS suprimentos,
        COALESCE(SUM(CASE WHEN type = 'SANGRIA' THEN amount ELSE 0 END), 0) AS sangrias
       FROM cash_transactions
       WHERE cash_register_id = $1;`,
      [registerId]
    );

    const suprimentos = Number(transRes.rows[0].suprimentos || 0);
    const sangrias = Number(transRes.rows[0].sangrias || 0);
    const opening = Number(reg.opening_balance || 0);

    // Saldo esperado em gaveta = Abertura + Vendas em Dinheiro + Suprimentos - Sangrias
    const expected = opening + totalDinheiroVendas + suprimentos - sangrias;
    const counted = Number(countedBalance) || 0;
    const diff = counted - expected;

    const updateRes = await client.query(
      `UPDATE cash_registers
       SET 
        closing_balance = $1,
        expected_balance = $2,
        difference = $3,
        closed_at = NOW(),
        status = 'CLOSED',
        notes = COALESCE($4, notes),
        updated_at = NOW()
       WHERE id = $5
       RETURNING *;`,
      [counted, expected, diff, notes?.trim() || null, registerId]
    );

    await client.query('COMMIT');

    const updated = updateRes.rows[0];
    return {
      id: updated.id,
      operatorId: updated.operator_id,
      openedAt: updated.opened_at,
      closedAt: updated.closed_at,
      openingBalance: Number(updated.opening_balance),
      closingBalance: Number(updated.closing_balance),
      expectedBalance: Number(updated.expected_balance),
      difference: Number(updated.difference),
      status: updated.status,
      notes: updated.notes,
      createdAt: updated.created_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cria uma venda com baixa atômica de estoque no PostgreSQL
 */
export async function createSale(data: {
  operatorId: string;
  registerId?: string | null;
  items: SaleItemInput[];
  discount?: number;
  paymentMethod: 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'FIADO';
  amountPaid: number;
  customerName?: string;
}): Promise<Sale> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  if (!data.items || data.items.length === 0) {
    throw new Error('A venda deve conter pelo menos um item.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Processa e valida cada item no banco com bloqueio de linha FOR UPDATE
    let calculatedSubtotal = 0;
    const processedItems: Array<{
      productId: string;
      name: string;
      barcode: string | null;
      unit: string;
      quantity: number;
      unitPrice: number;
      costPrice: number;
      totalPrice: number;
      previousStock: number;
      newStock: number;
    }> = [];

    for (const item of data.items) {
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error('Quantidade de item inválida.');
      }

      const prodRes = await client.query<{
        id: string;
        name: string;
        barcode: string | null;
        unit: string;
        cost_price: string;
        selling_price: string;
        stock_quantity: string;
      }>(
        'SELECT id, name, barcode, unit, cost_price, selling_price, stock_quantity FROM products WHERE id = $1 FOR UPDATE;',
        [item.productId]
      );

      if (prodRes.rows.length === 0) {
        throw new Error(`Produto id ${item.productId} não encontrado.`);
      }

      const prod = prodRes.rows[0];
      const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(prod.selling_price);
      const costPrice = Number(prod.cost_price || 0);
      const itemTotal = Number((unitPrice * qty).toFixed(2));
      const currentStock = Number(prod.stock_quantity);
      const newStock = Number((currentStock - qty).toFixed(3));

      calculatedSubtotal += itemTotal;

      processedItems.push({
        productId: prod.id,
        name: prod.name,
        barcode: prod.barcode,
        unit: prod.unit,
        quantity: qty,
        unitPrice,
        costPrice,
        totalPrice: itemTotal,
        previousStock: currentStock,
        newStock,
      });

      // Baixa no estoque do produto
      await client.query(
        'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2;',
        [newStock, prod.id]
      );
    }

    const discount = Math.max(0, Number(data.discount) || 0);
    const total = Math.max(0, Number((calculatedSubtotal - discount).toFixed(2)));
    const amountPaid = Number(data.amountPaid) || total;

    if (data.paymentMethod === 'DINHEIRO' && amountPaid < total) {
      throw new Error(`Valor em dinheiro insuficiente. Total: R$ ${total.toFixed(2)}, Recebido: R$ ${amountPaid.toFixed(2)}.`);
    }

    const changeAmount = data.paymentMethod === 'DINHEIRO'
      ? Math.max(0, Number((amountPaid - total).toFixed(2)))
      : 0;

    // 2. Registra a venda
    const saleRes = await client.query<{
      id: string;
      sale_number: number;
      created_at: string;
    }>(
      `INSERT INTO sales (
        cash_register_id, operator_id, subtotal, discount, total,
        payment_method, amount_paid, change_amount, customer_name, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'COMPLETED')
      RETURNING id, sale_number, created_at;`,
      [
        data.registerId || null,
        data.operatorId,
        calculatedSubtotal,
        discount,
        total,
        data.paymentMethod,
        amountPaid,
        changeAmount,
        data.customerName?.trim() || null,
      ]
    );

    const createdSale = saleRes.rows[0];

    // 3. Registra os itens da venda e a movimentação no estoque
    const insertedItems: SaleItem[] = [];

    for (const item of processedItems) {
      const itemRes = await client.query<{ id: string }>(
        `INSERT INTO sale_items (
          sale_id, product_id, product_name, barcode, unit,
          quantity, unit_price, cost_price, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id;`,
        [
          createdSale.id,
          item.productId,
          item.name,
          item.barcode,
          item.unit,
          item.quantity,
          item.unitPrice,
          item.costPrice,
          item.totalPrice,
        ]
      );

      // Registra a saída no histórico de estoque
      await client.query(
        `INSERT INTO stock_movements (
          product_id, type, quantity, previous_stock, new_stock, reason, user_id
        ) VALUES ($1, 'VENDA', $2, $3, $4, $5, $6);`,
        [
          item.productId,
          item.quantity,
          item.previousStock,
          item.newStock,
          `Venda PDV #${createdSale.sale_number}`,
          data.operatorId,
        ]
      );

      insertedItems.push({
        id: itemRes.rows[0].id,
        saleId: createdSale.id,
        productId: item.productId,
        productName: item.name,
        barcode: item.barcode,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        totalPrice: item.totalPrice,
      });
    }

    await client.query('COMMIT');

    return {
      id: createdSale.id,
      saleNumber: createdSale.sale_number,
      cashRegisterId: data.registerId || null,
      operatorId: data.operatorId,
      subtotal: calculatedSubtotal,
      discount,
      total,
      paymentMethod: data.paymentMethod,
      amountPaid,
      changeAmount,
      customerName: data.customerName?.trim() || null,
      status: 'COMPLETED',
      cancellationReason: null,
      createdAt: createdSale.created_at,
      items: insertedItems,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cancela uma venda e estorna os produtos de volta ao estoque
 */
export async function cancelSale(
  saleId: string,
  operatorId: string,
  reason: string
): Promise<Sale> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const safeReason = (reason || '').trim();
  if (!safeReason) {
    throw new Error('Informe o motivo do cancelamento da venda.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saleRes = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE;', [saleId]);
    if (saleRes.rows.length === 0) throw new Error('Venda não encontrada.');
    const sale = saleRes.rows[0];

    if (sale.status === 'CANCELLED') {
      throw new Error('Esta venda já está cancelada.');
    }

    // Busca os itens vendidos
    const itemsRes = await client.query<{
      product_id: string;
      quantity: string;
    }>('SELECT product_id, quantity FROM sale_items WHERE sale_id = $1;', [saleId]);

    // Estorna cada item no estoque
    for (const item of itemsRes.rows) {
      const qty = Number(item.quantity);
      const prodRes = await client.query<{ stock_quantity: string }>(
        'SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE;',
        [item.product_id]
      );

      if (prodRes.rows.length > 0) {
        const currentStock = Number(prodRes.rows[0].stock_quantity);
        const restoredStock = currentStock + qty;

        await client.query(
          'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2;',
          [restoredStock, item.product_id]
        );

        await client.query(
          `INSERT INTO stock_movements (
            product_id, type, quantity, previous_stock, new_stock, reason, user_id
          ) VALUES ($1, 'ENTRADA', $2, $3, $4, $5, $6);`,
          [
            item.product_id,
            qty,
            currentStock,
            restoredStock,
            `Estorno por cancelamento da venda #${sale.sale_number}: ${safeReason}`,
            operatorId,
          ]
        );
      }
    }

    // Atualiza status da venda
    const updateRes = await client.query(
      `UPDATE sales
       SET status = 'CANCELLED', cancellation_reason = $1
       WHERE id = $2
       RETURNING *;`,
      [safeReason, saleId]
    );

    await client.query('COMMIT');

    const updated = updateRes.rows[0];
    return {
      id: updated.id,
      saleNumber: updated.sale_number,
      cashRegisterId: updated.cash_register_id,
      operatorId: updated.operator_id,
      subtotal: Number(updated.subtotal),
      discount: Number(updated.discount),
      total: Number(updated.total),
      paymentMethod: updated.payment_method,
      amountPaid: Number(updated.amount_paid),
      changeAmount: Number(updated.change_amount),
      customerName: updated.customer_name,
      status: updated.status,
      cancellationReason: updated.cancellation_reason,
      createdAt: updated.created_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Lista o histórico recente de vendas
 */
export async function listSales(filters?: {
  limit?: number;
  status?: string;
}): Promise<Sale[]> {
  const pool = getDbPool();
  if (!pool) return [];

  let query = `
    SELECT s.*, u.name AS operator_name
    FROM sales s
    JOIN users u ON s.operator_id = u.id
  `;
  const params: unknown[] = [];

  if (filters?.status) {
    query += ' WHERE s.status = $1';
    params.push(filters.status);
  }

  query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1};`;
  params.push(filters?.limit || 50);

  const res = await pool.query(query, params);

  return res.rows.map(r => ({
    id: r.id,
    saleNumber: r.sale_number,
    cashRegisterId: r.cash_register_id,
    operatorId: r.operator_id,
    operatorName: r.operator_name,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    total: Number(r.total),
    paymentMethod: r.payment_method,
    amountPaid: Number(r.amount_paid),
    changeAmount: Number(r.change_amount),
    customerName: r.customer_name,
    status: r.status,
    cancellationReason: r.cancellation_reason,
    createdAt: r.created_at,
  }));
}

/**
 * Consulta métricas financeiras de vendas do dia atual
 */
export async function getTodaySalesMetrics(): Promise<TodaySalesMetrics> {
  const pool = getDbPool();
  if (!pool) {
    return {
      totalSalesCount: 0,
      totalRevenue: 0,
      estimatedProfit: 0,
      byPaymentMethod: { dinheiro: 0, pix: 0, debito: 0, credito: 0, fiado: 0 },
    };
  }

  // Consulta vendas concluídas de hoje
  const res = await pool.query<{
    sales_count: string;
    total_revenue: string;
    dinheiro: string;
    pix: string;
    debito: string;
    credito: string;
    fiado: string;
  }>(`
    SELECT 
      COUNT(*) AS sales_count,
      COALESCE(SUM(total), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN payment_method = 'DINHEIRO' THEN total ELSE 0 END), 0) AS dinheiro,
      COALESCE(SUM(CASE WHEN payment_method = 'PIX' THEN total ELSE 0 END), 0) AS pix,
      COALESCE(SUM(CASE WHEN payment_method = 'DEBITO' THEN total ELSE 0 END), 0) AS debito,
      COALESCE(SUM(CASE WHEN payment_method = 'CREDITO' THEN total ELSE 0 END), 0) AS credito,
      COALESCE(SUM(CASE WHEN payment_method = 'FIADO' THEN total ELSE 0 END), 0) AS fiado
    FROM sales
    WHERE status = 'COMPLETED' AND created_at >= CURRENT_DATE;
  `);

  // Calcula lucro bruto de hoje: (Preço Venda - Preço Custo) dos itens vendidos hoje
  const profitRes = await pool.query<{ estimated_profit: string }>(`
    SELECT COALESCE(SUM(si.total_price - (si.cost_price * si.quantity)), 0) AS estimated_profit
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'COMPLETED' AND s.created_at >= CURRENT_DATE;
  `);

  const row = res.rows[0];
  return {
    totalSalesCount: Number(row?.sales_count || 0),
    totalRevenue: Number(row?.total_revenue || 0),
    estimatedProfit: Number(profitRes.rows[0]?.estimated_profit || 0),
    byPaymentMethod: {
      dinheiro: Number(row?.dinheiro || 0),
      pix: Number(row?.pix || 0),
      debito: Number(row?.debito || 0),
      credito: Number(row?.credito || 0),
      fiado: Number(row?.fiado || 0),
    },
  };
}
