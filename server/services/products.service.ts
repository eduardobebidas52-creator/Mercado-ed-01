/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDbPool } from '../db/connection.js';

export interface CategoryItem {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
}

export interface ProductItem {
  id: string;
  barcode: string | null;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  profitMarginPercent: number;
  stockQuantity: number;
  minStockAlert: number;
  isLowStock: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductMetrics {
  totalProducts: number;
  totalStockUnits: number;
  totalCostValue: number;
  totalSellingValue: number;
  lowStockCount: number;
}

/**
 * Calcula a margem de lucro oficial no backend
 * Margem de Markup sobre o custo: ((Venda - Custo) / Custo) * 100
 */
export function calculateProfitMargin(costPrice: number, sellingPrice: number): number {
  if (costPrice <= 0) return 0;
  const margin = ((sellingPrice - costPrice) / costPrice) * 100;
  return Number(margin.toFixed(2));
}

/**
 * Lista todas as categorias cadastradas
 */
export async function listCategories(): Promise<CategoryItem[]> {
  const pool = getDbPool();
  if (!pool) return [];

  const res = await pool.query<{
    id: string;
    name: string;
    color: string;
    created_at: string;
  }>('SELECT id, name, color, created_at FROM categories ORDER BY name ASC;');

  return res.rows.map(r => ({
    id: r.id,
    name: r.name,
    color: r.color || '#2563eb',
    createdAt: r.created_at,
  }));
}

/**
 * Cria uma nova categoria
 */
export async function createCategory(name: string, color?: string): Promise<CategoryItem> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const safeName = (name || '').trim();
  if (!safeName) throw new Error('Nome da categoria é obrigatório.');

  const res = await pool.query<{
    id: string;
    name: string;
    color: string;
    created_at: string;
  }>(
    `INSERT INTO categories (name, color)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color
     RETURNING id, name, color, created_at;`,
    [safeName, color || '#2563eb']
  );

  const row = res.rows[0];
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

/**
 * Lista produtos com filtros, busca e cálculo de margem
 */
export async function listProducts(options?: {
  search?: string;
  categoryId?: string;
  onlyLowStock?: boolean;
}): Promise<ProductItem[]> {
  const pool = getDbPool();
  if (!pool) return [];

  let query = `
    SELECT 
      p.id,
      p.barcode,
      p.name,
      p.description,
      p.category_id,
      c.name AS category_name,
      c.color AS category_color,
      p.unit,
      p.cost_price,
      p.selling_price,
      p.stock_quantity,
      p.min_stock_alert,
      p.is_active,
      p.created_at,
      p.updated_at
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = true
  `;

  const params: unknown[] = [];
  let paramIndex = 1;

  if (options?.search) {
    const term = `%${options.search.trim()}%`;
    query += ` AND (p.name ILIKE $${paramIndex} OR p.barcode ILIKE $${paramIndex})`;
    params.push(term);
    paramIndex++;
  }

  if (options?.categoryId) {
    query += ` AND p.category_id = $${paramIndex}`;
    params.push(options.categoryId);
    paramIndex++;
  }

  if (options?.onlyLowStock) {
    query += ' AND p.stock_quantity <= p.min_stock_alert AND p.min_stock_alert > 0';
  }

  query += ' ORDER BY p.name ASC;';

  const res = await pool.query(query, params);

  return res.rows.map(r => {
    const cost = Number(r.cost_price || 0);
    const selling = Number(r.selling_price || 0);
    const stock = Number(r.stock_quantity || 0);
    const minStock = Number(r.min_stock_alert || 0);

    return {
      id: r.id,
      barcode: r.barcode,
      name: r.name,
      description: r.description,
      categoryId: r.category_id,
      categoryName: r.category_name || 'Sem categoria',
      categoryColor: r.category_color || '#64748b',
      unit: r.unit || 'UN',
      costPrice: cost,
      sellingPrice: selling,
      profitMarginPercent: calculateProfitMargin(cost, selling),
      stockQuantity: stock,
      minStockAlert: minStock,
      isLowStock: minStock > 0 && stock <= minStock,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

/**
 * Busca produto por ID ou Código de Barras
 */
export async function getProductByBarcodeOrId(identifier: string): Promise<ProductItem | null> {
  const pool = getDbPool();
  if (!pool) return null;

  const res = await pool.query(
    `SELECT 
      p.id,
      p.barcode,
      p.name,
      p.description,
      p.category_id,
      c.name AS category_name,
      c.color AS category_color,
      p.unit,
      p.cost_price,
      p.selling_price,
      p.stock_quantity,
      p.min_stock_alert,
      p.is_active,
      p.created_at,
      p.updated_at
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE (p.id::text = $1 OR p.barcode = $1) AND p.is_active = true
    LIMIT 1;`,
    [identifier]
  );

  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  const cost = Number(r.cost_price || 0);
  const selling = Number(r.selling_price || 0);
  const stock = Number(r.stock_quantity || 0);
  const minStock = Number(r.min_stock_alert || 0);

  return {
    id: r.id,
    barcode: r.barcode,
    name: r.name,
    description: r.description,
    categoryId: r.category_id,
    categoryName: r.category_name || 'Sem categoria',
    categoryColor: r.category_color || '#64748b',
    unit: r.unit || 'UN',
    costPrice: cost,
    sellingPrice: selling,
    profitMarginPercent: calculateProfitMargin(cost, selling),
    stockQuantity: stock,
    minStockAlert: minStock,
    isLowStock: minStock > 0 && stock <= minStock,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Cadastra um novo produto com validações de unicidade de código de barras
 */
export async function createProduct(data: {
  barcode?: string;
  name: string;
  description?: string;
  categoryId?: string;
  unit?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity?: number;
  minStockAlert?: number;
  userId?: string;
}): Promise<ProductItem> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const safeName = (data.name || '').trim();
  if (!safeName) throw new Error('O nome do produto é obrigatório.');

  const safeCost = Number(data.costPrice) || 0;
  const safeSelling = Number(data.sellingPrice) || 0;
  if (safeCost < 0 || safeSelling < 0) {
    throw new Error('Preço de custo e de venda não podem ser negativos.');
  }

  const safeStock = Number(data.stockQuantity) || 0;
  const safeMin = Number(data.minStockAlert) || 0;
  const safeBarcode = data.barcode?.trim() || null;
  const safeUnit = (data.unit || 'UN').trim().toUpperCase();

  // Verifica se código de barras já existe
  if (safeBarcode) {
    const existing = await pool.query('SELECT id FROM products WHERE barcode = $1;', [safeBarcode]);
    if (existing.rows.length > 0) {
      throw new Error(`O código de barras "${safeBarcode}" já está cadastrado em outro produto.`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertRes = await client.query(
      `INSERT INTO products (
        barcode, name, description, category_id, unit,
        cost_price, selling_price, stock_quantity, min_stock_alert, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *;`,
      [
        safeBarcode,
        safeName,
        data.description?.trim() || null,
        data.categoryId || null,
        safeUnit,
        safeCost,
        safeSelling,
        safeStock,
        safeMin,
      ]
    );

    const created = insertRes.rows[0];

    // Se houve estoque inicial, registra movimentação
    if (safeStock > 0) {
      await client.query(
        `INSERT INTO stock_movements (
          product_id, type, quantity, previous_stock, new_stock, reason, user_id
        ) VALUES ($1, 'ENTRADA', $2, 0, $2, 'Cadastro inicial de estoque', $3);`,
        [created.id, safeStock, data.userId || null]
      );
    }

    await client.query('COMMIT');

    const product = await getProductByBarcodeOrId(created.id);
    if (!product) throw new Error('Falha ao recuperar produto cadastrado.');
    return product;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Atualiza dados cadastrais de um produto
 */
export async function updateProduct(
  id: string,
  data: Partial<{
    barcode?: string | null;
    name?: string;
    description?: string | null;
    categoryId?: string | null;
    unit?: string;
    costPrice?: number;
    sellingPrice?: number;
    minStockAlert?: number;
    isActive?: boolean;
  }>
): Promise<ProductItem> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const existingRes = await pool.query('SELECT id, barcode FROM products WHERE id = $1;', [id]);
  if (existingRes.rows.length === 0) {
    throw new Error('Produto não encontrado.');
  }

  // Se alterou código de barras, verifica unicidade
  if (data.barcode !== undefined && data.barcode !== null && data.barcode.trim() !== '') {
    const checkBarcode = await pool.query(
      'SELECT id FROM products WHERE barcode = $1 AND id <> $2;',
      [data.barcode.trim(), id]
    );
    if (checkBarcode.rows.length > 0) {
      throw new Error(`Código de barras "${data.barcode}" já pertence a outro produto.`);
    }
  }

  const updates: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [id];
  let paramIdx = 2;

  if (data.name !== undefined) {
    const safeName = data.name.trim();
    if (!safeName) throw new Error('Nome do produto não pode ficar vazio.');
    updates.push(`name = $${paramIdx++}`);
    params.push(safeName);
  }

  if (data.barcode !== undefined) {
    updates.push(`barcode = $${paramIdx++}`);
    params.push(data.barcode?.trim() || null);
  }

  if (data.description !== undefined) {
    updates.push(`description = $${paramIdx++}`);
    params.push(data.description?.trim() || null);
  }

  if (data.categoryId !== undefined) {
    updates.push(`category_id = $${paramIdx++}`);
    params.push(data.categoryId || null);
  }

  if (data.unit !== undefined) {
    updates.push(`unit = $${paramIdx++}`);
    params.push(data.unit.trim().toUpperCase() || 'UN');
  }

  if (data.costPrice !== undefined) {
    const cost = Math.max(0, Number(data.costPrice) || 0);
    updates.push(`cost_price = $${paramIdx++}`);
    params.push(cost);
  }

  if (data.sellingPrice !== undefined) {
    const selling = Math.max(0, Number(data.sellingPrice) || 0);
    updates.push(`selling_price = $${paramIdx++}`);
    params.push(selling);
  }

  if (data.minStockAlert !== undefined) {
    const min = Math.max(0, Number(data.minStockAlert) || 0);
    updates.push(`min_stock_alert = $${paramIdx++}`);
    params.push(min);
  }

  if (data.isActive !== undefined) {
    updates.push(`is_active = $${paramIdx++}`);
    params.push(Boolean(data.isActive));
  }

  const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $1 RETURNING id;`;
  await pool.query(query, params);

  const updated = await getProductByBarcodeOrId(id);
  if (!updated) throw new Error('Falha ao obter produto atualizado.');
  return updated;
}

/**
 * Movimentação auditada de estoque (Entrada, Saída, Ajuste)
 */
export async function adjustProductStock(
  productId: string,
  data: {
    type: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
    quantity: number;
    reason: string;
    userId?: string;
  }
): Promise<{ product: ProductItem; movementId: string }> {
  const pool = getDbPool();
  if (!pool) throw new Error('Banco de dados PostgreSQL não conectado.');

  const qty = Number(data.quantity);
  if (isNaN(qty) || qty < 0) {
    throw new Error('Quantidade informada deve ser um número positivo.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bloqueia linha para evitar condição de corrida em concorrência
    const prodRes = await client.query<{ stock_quantity: string }>(
      'SELECT stock_quantity FROM products WHERE id = $1 FOR UPDATE;',
      [productId]
    );

    if (prodRes.rows.length === 0) {
      throw new Error('Produto não encontrado para movimentação de estoque.');
    }

    const currentStock = Number(prodRes.rows[0].stock_quantity);
    let newStock = currentStock;

    if (data.type === 'ENTRADA') {
      newStock = currentStock + qty;
    } else if (data.type === 'SAIDA') {
      if (currentStock < qty) {
        throw new Error(`Estoque insuficiente. Disponível: ${currentStock}, Solicitado: ${qty}.`);
      }
      newStock = currentStock - qty;
    } else if (data.type === 'AJUSTE') {
      newStock = qty;
    }

    // Atualiza produto
    await client.query(
      'UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2;',
      [newStock, productId]
    );

    // Registra auditoria
    const movRes = await client.query<{ id: string }>(
      `INSERT INTO stock_movements (
        product_id, type, quantity, previous_stock, new_stock, reason, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;`,
      [
        productId,
        data.type,
        qty,
        currentStock,
        newStock,
        data.reason.trim() || 'Movimentação manual',
        data.userId || null,
      ]
    );

    await client.query('COMMIT');

    const updatedProduct = await getProductByBarcodeOrId(productId);
    if (!updatedProduct) throw new Error('Falha ao consultar produto atualizado.');

    return {
      product: updatedProduct,
      movementId: movRes.rows[0].id,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Remove (desativa) um produto
 */
export async function deleteProduct(productId: string): Promise<boolean> {
  const pool = getDbPool();
  if (!pool) return false;

  const res = await pool.query(
    'UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1;',
    [productId]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Métricas consolidadas de catálogo e estoque
 */
export async function getProductMetrics(): Promise<ProductMetrics> {
  const pool = getDbPool();
  if (!pool) {
    return {
      totalProducts: 0,
      totalStockUnits: 0,
      totalCostValue: 0,
      totalSellingValue: 0,
      lowStockCount: 0,
    };
  }

  const res = await pool.query<{
    total_products: string;
    total_stock_units: string;
    total_cost_value: string;
    total_selling_value: string;
    low_stock_count: string;
  }>(`
    SELECT 
      COUNT(*) AS total_products,
      COALESCE(SUM(stock_quantity), 0) AS total_stock_units,
      COALESCE(SUM(stock_quantity * cost_price), 0) AS total_cost_value,
      COALESCE(SUM(stock_quantity * selling_price), 0) AS total_selling_value,
      COUNT(*) FILTER (WHERE stock_quantity <= min_stock_alert AND min_stock_alert > 0) AS low_stock_count
    FROM products
    WHERE is_active = true;
  `);

  const row = res.rows[0];
  return {
    totalProducts: Number(row?.total_products || 0),
    totalStockUnits: Number(row?.total_stock_units || 0),
    totalCostValue: Number(row?.total_cost_value || 0),
    totalSellingValue: Number(row?.total_selling_value || 0),
    lowStockCount: Number(row?.low_stock_count || 0),
  };
}
