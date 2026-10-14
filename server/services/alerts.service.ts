/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDbPool } from '../db/connection.js';

export interface AlertCounts {
  expiredCount: number;
  expiring7DaysCount: number;
  expiring30DaysCount: number;
  totalValidityAlerts: number;
  zeroStockCount: number;
  lowStockCount: number;
  totalStockAlerts: number;
}

export interface ExpiryAlertItem {
  id: string;
  productId: string;
  productName: string;
  barcode: string | null;
  unit: string;
  categoryName: string | null;
  categoryColor: string | null;
  batchNumber: string;
  expirationDate: string;
  quantity: number;
  supplierName: string | null;
  costPrice: number;
  sellingPrice: number;
  isChecked: boolean;
  checkedAt: string | null;
  status: string;
  notes: string | null;
  daysRemaining: number;
  alertLevel: 'EXPIRED' | 'WARNING_7' | 'WARNING_30' | 'SAFE';
}

export interface StockAlertItem {
  id: string;
  barcode: string | null;
  name: string;
  unit: string;
  categoryName: string | null;
  categoryColor: string | null;
  supplierName: string | null;
  stockQuantity: number;
  minStockAlert: number;
  idealStock: number;
  costPrice: number;
  sellingPrice: number;
  status: 'ZERO' | 'LOW';
  suggestedReplenishment: number;
  estimatedCost: number;
}

export interface AlertSettings {
  yellowDaysThreshold: number;
  orangeDaysThreshold: number;
}

export interface ShoppingListItem {
  productId: string;
  barcode: string | null;
  productName: string;
  categoryName: string | null;
  supplierName: string | null;
  currentStock: number;
  minStock: number;
  idealStock: number;
  suggestedQuantity: number;
  unit: string;
  costPrice: number;
  totalEstimatedCost: number;
  urgency: 'CRITICAL' | 'HIGH';
}

/**
 * Retorna as configurações de dias para alertas de validade
 */
export async function getAlertSettings(): Promise<AlertSettings> {
  const pool = getDbPool();
  if (!pool) return { yellowDaysThreshold: 30, orangeDaysThreshold: 7 };

  try {
    const res = await pool.query<{
      yellow_days_threshold: number;
      orange_days_threshold: number;
    }>('SELECT yellow_days_threshold, orange_days_threshold FROM alert_settings WHERE id = 1 LIMIT 1;');

    if (res.rows.length === 0) {
      return { yellowDaysThreshold: 30, orangeDaysThreshold: 7 };
    }

    return {
      yellowDaysThreshold: Number(res.rows[0].yellow_days_threshold) || 30,
      orangeDaysThreshold: Number(res.rows[0].orange_days_threshold) || 7,
    };
  } catch {
    return { yellowDaysThreshold: 30, orangeDaysThreshold: 7 };
  }
}

/**
 * Atualiza os limites de dias para alertas amarelo e laranja
 */
export async function updateAlertSettings(yellowDays: number, orangeDays: number): Promise<AlertSettings> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  if (yellowDays <= orangeDays) {
    throw new Error('O período de alerta amarelo deve ser maior que o período laranja.');
  }

  await pool.query(
    `INSERT INTO alert_settings (id, yellow_days_threshold, orange_days_threshold, updated_at)
     VALUES (1, $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET
       yellow_days_threshold = EXCLUDED.yellow_days_threshold,
       orange_days_threshold = EXCLUDED.orange_days_threshold,
       updated_at = NOW();`,
    [yellowDays, orangeDays]
  );

  return { yellowDaysThreshold: yellowDays, orangeDaysThreshold: orangeDays };
}

/**
 * Retorna os contadores em tempo real para o menu lateral e dashboard
 */
export async function getAlertCounts(): Promise<AlertCounts> {
  const pool = getDbPool();
  if (!pool) {
    return {
      expiredCount: 0,
      expiring7DaysCount: 0,
      expiring30DaysCount: 0,
      totalValidityAlerts: 0,
      zeroStockCount: 0,
      lowStockCount: 0,
      totalStockAlerts: 0,
    };
  }

  const settings = await getAlertSettings();

  try {
    // 1. Contadores de Validade
    const valRes = await pool.query<{
      expired_count: string;
      orange_count: string;
      yellow_count: string;
    }>(
      `SELECT 
         COUNT(*) FILTER (WHERE pb.expiration_date < CURRENT_DATE) AS expired_count,
         COUNT(*) FILTER (WHERE pb.expiration_date >= CURRENT_DATE AND pb.expiration_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL) AS orange_count,
         COUNT(*) FILTER (WHERE pb.expiration_date > CURRENT_DATE + ($1 || ' days')::INTERVAL AND pb.expiration_date <= CURRENT_DATE + ($2 || ' days')::INTERVAL) AS yellow_count
       FROM product_batches pb
       JOIN products p ON p.id = pb.product_id
       WHERE pb.quantity > 0 AND pb.status = 'ACTIVE' AND p.is_active = true;`,
      [settings.orangeDaysThreshold, settings.yellowDaysThreshold]
    );

    const expired = Number(valRes.rows[0]?.expired_count || 0);
    const orange = Number(valRes.rows[0]?.orange_count || 0);
    const yellow = Number(valRes.rows[0]?.yellow_count || 0);

    // 2. Contadores de Estoque
    const stockRes = await pool.query<{
      zero_count: string;
      low_count: string;
    }>(
      `SELECT 
         COUNT(*) FILTER (WHERE stock_quantity <= 0) AS zero_count,
         COUNT(*) FILTER (WHERE stock_quantity > 0 AND stock_quantity <= min_stock_alert AND min_stock_alert > 0) AS low_count
       FROM products
       WHERE is_active = true;`
    );

    const zero = Number(stockRes.rows[0]?.zero_count || 0);
    const low = Number(stockRes.rows[0]?.low_count || 0);

    return {
      expiredCount: expired,
      expiring7DaysCount: orange,
      expiring30DaysCount: yellow,
      totalValidityAlerts: expired + orange + yellow,
      zeroStockCount: zero,
      lowStockCount: low,
      totalStockAlerts: zero + low,
    };
  } catch (error) {
    console.error('[AlertsService] Falha ao consultar contagens de alerta:', error);
    return {
      expiredCount: 0,
      expiring7DaysCount: 0,
      expiring30DaysCount: 0,
      totalValidityAlerts: 0,
      zeroStockCount: 0,
      lowStockCount: 0,
      totalStockAlerts: 0,
    };
  }
}

/**
 * Lista alertas de validade com filtros detalhados
 */
export async function listExpiryAlerts(filters: {
  status?: 'ALL' | 'EXPIRED' | 'WARNING_7' | 'WARNING_30' | 'NOT_CHECKED';
  categoryId?: string;
  search?: string;
}): Promise<ExpiryAlertItem[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const settings = await getAlertSettings();

  const conditions: string[] = ["pb.quantity > 0", "pb.status = 'ACTIVE'", "p.is_active = true"];
  const params: unknown[] = [settings.orangeDaysThreshold, settings.yellowDaysThreshold];
  let paramIndex = 3;

  if (filters.categoryId) {
    conditions.push(`p.category_id = $${paramIndex}`);
    params.push(filters.categoryId);
    paramIndex++;
  }

  if (filters.search) {
    conditions.push(`(p.name ILIKE $${paramIndex} OR p.barcode ILIKE $${paramIndex} OR pb.batch_number ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (filters.status === 'NOT_CHECKED') {
    conditions.push('pb.is_checked = false');
  } else if (filters.status === 'EXPIRED') {
    conditions.push('pb.expiration_date < CURRENT_DATE');
  } else if (filters.status === 'WARNING_7') {
    conditions.push(`pb.expiration_date >= CURRENT_DATE AND pb.expiration_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL`);
  } else if (filters.status === 'WARNING_30') {
    conditions.push(`pb.expiration_date > CURRENT_DATE + ($1 || ' days')::INTERVAL AND pb.expiration_date <= CURRENT_DATE + ($2 || ' days')::INTERVAL`);
  }

  const query = `
    SELECT 
      pb.id,
      pb.product_id,
      p.name AS product_name,
      p.barcode,
      p.unit,
      c.name AS category_name,
      c.color AS category_color,
      pb.batch_number,
      TO_CHAR(pb.expiration_date, 'YYYY-MM-DD') AS expiration_date,
      pb.quantity,
      COALESCE(pb.supplier_name, p.supplier_name) AS supplier_name,
      p.cost_price,
      p.selling_price,
      pb.is_checked,
      pb.checked_at,
      pb.status,
      pb.notes,
      (pb.expiration_date - CURRENT_DATE) AS days_remaining
    FROM product_batches pb
    JOIN products p ON p.id = pb.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY pb.expiration_date ASC, p.name ASC;
  `;

  const res = await pool.query<{
    id: string;
    product_id: string;
    product_name: string;
    barcode: string | null;
    unit: string;
    category_name: string | null;
    category_color: string | null;
    batch_number: string;
    expiration_date: string;
    quantity: string;
    supplier_name: string | null;
    cost_price: string;
    selling_price: string;
    is_checked: boolean;
    checked_at: string | null;
    status: string;
    notes: string | null;
    days_remaining: number;
  }>(query, params);

  return res.rows.map(row => {
    const days = Number(row.days_remaining);
    let alertLevel: 'EXPIRED' | 'WARNING_7' | 'WARNING_30' | 'SAFE' = 'SAFE';

    if (days < 0) {
      alertLevel = 'EXPIRED';
    } else if (days <= settings.orangeDaysThreshold) {
      alertLevel = 'WARNING_7';
    } else if (days <= settings.yellowDaysThreshold) {
      alertLevel = 'WARNING_30';
    }

    return {
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      barcode: row.barcode,
      unit: row.unit || 'UN',
      categoryName: row.category_name,
      categoryColor: row.category_color,
      batchNumber: row.batch_number,
      expirationDate: row.expiration_date,
      quantity: Number(row.quantity),
      supplierName: row.supplier_name,
      costPrice: Number(row.cost_price),
      sellingPrice: Number(row.selling_price),
      isChecked: row.is_checked,
      checkedAt: row.checked_at,
      status: row.status,
      notes: row.notes,
      daysRemaining: days,
      alertLevel,
    };
  });
}

/**
 * Marca um lote como conferido pelo operador
 */
export async function markBatchChecked(batchId: string, isChecked: boolean): Promise<boolean> {
  const pool = getDbPool();
  if (!pool) return false;

  const res = await pool.query(
    `UPDATE product_batches 
     SET is_checked = $1, 
         checked_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END, 
         updated_at = NOW() 
     WHERE id = $2;`,
    [isChecked, batchId]
  );

  return (res.rowCount ?? 0) > 0;
}

/**
 * Cadastra um novo lote de produto com validade
 */
export async function createProductBatch(data: {
  productId: string;
  batchNumber: string;
  expirationDate: string;
  quantity: number;
  supplierName?: string;
  notes?: string;
  addToStock?: boolean;
  userId?: string;
}): Promise<ExpiryAlertItem> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insere o lote
    const batchRes = await client.query<{ id: string }>(
      `INSERT INTO product_batches (
         product_id, batch_number, expiration_date, quantity, supplier_name, notes
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id;`,
      [
        data.productId,
        data.batchNumber.trim().toUpperCase(),
        data.expirationDate,
        data.quantity,
        data.supplierName?.trim() || null,
        data.notes?.trim() || null,
      ]
    );

    const batchId = batchRes.rows[0].id;

    // Se solicitado adicionar ao estoque geral do produto
    if (data.addToStock && data.quantity > 0) {
      const prodRes = await client.query<{ stock_quantity: string }>(
        'SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE;',
        [data.productId]
      );

      if (prodRes.rows.length > 0) {
        const currentStock = Number(prodRes.rows[0].stock_quantity);
        const newStock = currentStock + data.quantity;

        await client.query(
          'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2;',
          [newStock, data.productId]
        );

        await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, user_id)
           VALUES ($1, 'ENTRADA', $2, $3, $4, $5, $6);`,
          [
            data.productId,
            data.quantity,
            currentStock,
            newStock,
            `Entrada de mercadoria - Lote ${data.batchNumber}`,
            data.userId || null,
          ]
        );
      }
    }

    await client.query('COMMIT');

    const alerts = await listExpiryAlerts({ search: data.batchNumber });
    const created = alerts.find(a => a.id === batchId);
    if (!created) throw new Error('Lote cadastrado mas não foi possível localizá-lo.');
    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Registra perda, avaria ou baixa por validade vencida de um lote
 */
export async function registerBatchLoss(batchId: string, options: {
  quantity: number;
  reason: 'VENCIDO' | 'AVARIA' | 'PERDA' | 'OUTRO';
  notes?: string;
  userId?: string;
}): Promise<{ lossId: string; batchRemainingQty: number; productNewStock: number }> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Busca lote com lock
    const batchRes = await client.query<{
      id: string;
      product_id: string;
      batch_number: string;
      quantity: string;
    }>('SELECT id, product_id, batch_number, quantity FROM product_batches WHERE id = $1 FOR UPDATE;', [batchId]);

    if (batchRes.rows.length === 0) {
      throw new Error('Lote não encontrado.');
    }

    const batch = batchRes.rows[0];
    const batchCurrentQty = Number(batch.quantity);

    if (options.quantity <= 0) {
      throw new Error('A quantidade para baixa deve ser maior que zero.');
    }

    if (options.quantity > batchCurrentQty) {
      throw new Error(`Quantidade solicitada (${options.quantity}) é maior que a disponível no lote (${batchCurrentQty}).`);
    }

    const batchRemainingQty = batchCurrentQty - options.quantity;
    const newBatchStatus = batchRemainingQty === 0 ? 'DISCARDED' : 'ACTIVE';

    // 2. Atualiza o lote
    await client.query(
      `UPDATE product_batches 
       SET quantity = $1, status = $2, updated_at = NOW() 
       WHERE id = $3;`,
      [batchRemainingQty, newBatchStatus, batchId]
    );

    // 3. Busca o produto para calcular custo e abater do estoque geral
    const prodRes = await client.query<{
      stock_quantity: string;
      cost_price: string;
      name: string;
    }>('SELECT stock_quantity, cost_price, name FROM products WHERE id = $1 FOR UPDATE;', [batch.product_id]);

    if (prodRes.rows.length === 0) {
      throw new Error('Produto associado ao lote não foi encontrado.');
    }

    const prod = prodRes.rows[0];
    const currentProdStock = Number(prod.stock_quantity);
    const unitCost = Number(prod.cost_price);
    const totalLoss = unitCost * options.quantity;
    const newProdStock = Math.max(0, currentProdStock - options.quantity);

    // 4. Atualiza produto
    await client.query(
      'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2;',
      [newProdStock, batch.product_id]
    );

    // 5. Registra auditoria de movimentação de estoque
    await client.query(
      `INSERT INTO stock_movements (
         product_id, type, quantity, previous_stock, new_stock, reason, user_id
       ) VALUES ($1, 'SAIDA', $2, $3, $4, $5, $6);`,
      [
        batch.product_id,
        options.quantity,
        currentProdStock,
        newProdStock,
        `Baixa por ${options.reason.toLowerCase()}: Lote ${batch.batch_number}`,
        options.userId || null,
      ]
    );

    // 6. Registra na tabela de perdas (waste_records)
    const wasteRes = await client.query<{ id: string }>(
      `INSERT INTO waste_records (
         product_id, batch_id, quantity, unit_cost, total_loss, reason, notes, user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id;`,
      [
        batch.product_id,
        batchId,
        options.quantity,
        unitCost,
        totalLoss,
        options.reason,
        options.notes?.trim() || null,
        options.userId || null,
      ]
    );

    await client.query('COMMIT');

    return {
      lossId: wasteRes.rows[0].id,
      batchRemainingQty,
      productNewStock: newProdStock,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Lista alertas de estoque (produtos zerados ou com estoque abaixo do mínimo)
 */
export async function listStockAlerts(filters: {
  status?: 'ALL' | 'ZERO' | 'LOW';
  categoryId?: string;
  search?: string;
}): Promise<StockAlertItem[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const conditions: string[] = [
    'p.is_active = true',
    '(p.stock_quantity <= 0 OR (p.stock_quantity <= p.min_stock_alert AND p.min_stock_alert > 0))',
  ];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.categoryId) {
    conditions.push(`p.category_id = $${paramIndex}`);
    params.push(filters.categoryId);
    paramIndex++;
  }

  if (filters.search) {
    conditions.push(`(p.name ILIKE $${paramIndex} OR p.barcode ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (filters.status === 'ZERO') {
    conditions.push('p.stock_quantity <= 0');
  } else if (filters.status === 'LOW') {
    conditions.push('p.stock_quantity > 0 AND p.stock_quantity <= p.min_stock_alert');
  }

  const query = `
    SELECT 
      p.id,
      p.barcode,
      p.name,
      p.unit,
      c.name AS category_name,
      c.color AS category_color,
      p.supplier_name,
      p.stock_quantity,
      p.min_stock_alert,
      p.ideal_stock,
      p.cost_price,
      p.selling_price
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY (p.stock_quantity <= 0) DESC, p.stock_quantity ASC, p.name ASC;
  `;

  const res = await pool.query<{
    id: string;
    barcode: string | null;
    name: string;
    unit: string;
    category_name: string | null;
    category_color: string | null;
    supplier_name: string | null;
    stock_quantity: string;
    min_stock_alert: string;
    ideal_stock: string;
    cost_price: string;
    selling_price: string;
  }>(query, params);

  return res.rows.map(row => {
    const stock = Number(row.stock_quantity);
    const min = Number(row.min_stock_alert);
    const ideal = Number(row.ideal_stock);
    const cost = Number(row.cost_price);
    const isZero = stock <= 0;

    let suggested = 0;
    if (ideal > stock) {
      suggested = ideal - stock;
    } else if (min > 0) {
      suggested = Math.max((min * 2) - stock, 10);
    } else {
      suggested = 10;
    }

    return {
      id: row.id,
      barcode: row.barcode,
      name: row.name,
      unit: row.unit || 'UN',
      categoryName: row.category_name,
      categoryColor: row.category_color,
      supplierName: row.supplier_name,
      stockQuantity: stock,
      minStockAlert: min,
      idealStock: ideal,
      costPrice: cost,
      sellingPrice: Number(row.selling_price),
      status: isZero ? 'ZERO' : 'LOW',
      suggestedReplenishment: Math.ceil(suggested),
      estimatedCost: Math.ceil(suggested) * cost,
    };
  });
}

/**
 * Compila a lista de compras sugerida baseada nos alertas de estoque
 */
export async function generateShoppingList(): Promise<{
  items: ShoppingListItem[];
  totalItems: number;
  totalSuggestedUnits: number;
  totalEstimatedBudget: number;
}> {
  const alerts = await listStockAlerts({ status: 'ALL' });

  const items: ShoppingListItem[] = alerts.map(a => ({
    productId: a.id,
    barcode: a.barcode,
    productName: a.name,
    categoryName: a.categoryName,
    supplierName: a.supplierName,
    currentStock: a.stockQuantity,
    minStock: a.minStockAlert,
    idealStock: a.idealStock,
    suggestedQuantity: a.suggestedReplenishment,
    unit: a.unit,
    costPrice: a.costPrice,
    totalEstimatedCost: a.estimatedCost,
    urgency: a.status === 'ZERO' ? 'CRITICAL' : 'HIGH',
  }));

  const totalSuggestedUnits = items.reduce((sum, item) => sum + item.suggestedQuantity, 0);
  const totalEstimatedBudget = items.reduce((sum, item) => sum + item.totalEstimatedCost, 0);

  return {
    items,
    totalItems: items.length,
    totalSuggestedUnits,
    totalEstimatedBudget,
  };
}

/**
 * Popula lotes de demonstração para testes caso nenhum lote exista
 */
export async function seedDemoBatches(): Promise<number> {
  const pool = getDbPool();
  if (!pool) return 0;

  const countRes = await pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM product_batches;');
  if (Number(countRes.rows[0]?.count || 0) > 0) return 0;

  // Busca produtos existentes
  const prods = await pool.query<{ id: string; name: string }>(
    'SELECT id, name FROM products WHERE is_active = true LIMIT 6;'
  );

  if (prods.rows.length === 0) return 0;

  let inserted = 0;
  // 1. Um lote vencido há 5 dias (Vermelho)
  if (prods.rows[0]) {
    await pool.query(
      `INSERT INTO product_batches (product_id, batch_number, expiration_date, quantity, supplier_name, notes)
       VALUES ($1, 'LOT-VENC-01', CURRENT_DATE - INTERVAL '5 days', 6.000, 'Distribuidora Central', 'Lote vencido para teste de alerta vermelho e descarte');`,
      [prods.rows[0].id]
    );
    inserted++;
  }

  // 2. Um lote vencendo em 3 dias (Laranja)
  if (prods.rows[1] || prods.rows[0]) {
    const pId = prods.rows[1]?.id || prods.rows[0].id;
    await pool.query(
      `INSERT INTO product_batches (product_id, batch_number, expiration_date, quantity, supplier_name, notes)
       VALUES ($1, 'LOT-CRIT-02', CURRENT_DATE + INTERVAL '3 days', 12.000, 'Atacadista União', 'Vencimento crítico em 3 dias para promoção rápida');`,
      [pId]
    );
    inserted++;
  }

  // 3. Um lote vencendo em 18 dias (Amarelo)
  if (prods.rows[2] || prods.rows[0]) {
    const pId = prods.rows[2]?.id || prods.rows[0].id;
    await pool.query(
      `INSERT INTO product_batches (product_id, batch_number, expiration_date, quantity, supplier_name, notes)
       VALUES ($1, 'LOT-ALERTA-03', CURRENT_DATE + INTERVAL '18 days', 24.000, 'Laticínios da Fazenda', 'Vencimento em menos de 30 dias');`,
      [pId]
    );
    inserted++;
  }

  // 4. Um lote seguro com validade longa (Verde)
  if (prods.rows[3] || prods.rows[0]) {
    const pId = prods.rows[3]?.id || prods.rows[0].id;
    await pool.query(
      `INSERT INTO product_batches (product_id, batch_number, expiration_date, quantity, supplier_name, notes)
       VALUES ($1, 'LOT-SEGURO-04', CURRENT_DATE + INTERVAL '90 days', 50.000, 'Bebidas & Cia', 'Lote novo com 3 meses de validade');`,
      [pId]
    );
    inserted++;
  }

  return inserted;
}
