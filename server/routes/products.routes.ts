/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { 
  listProducts, 
  getProductByBarcodeOrId, 
  createProduct, 
  updateProduct, 
  adjustProductStock, 
  deleteProduct, 
  listCategories, 
  createCategory, 
  getProductMetrics 
} from '../services/products.service.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/products
 * Lista os produtos cadastrados com suporte a busca e filtros
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, categoryId, onlyLowStock } = req.query;
    const products = await listProducts({
      search: typeof search === 'string' ? search : undefined,
      categoryId: typeof categoryId === 'string' ? categoryId : undefined,
      onlyLowStock: onlyLowStock === 'true',
    });

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao listar produtos';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/products/metrics
 * Métricas consolidadas de inventário e valorização do estoque
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await getProductMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao obter métricas de produtos';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/products/categories
 * Lista as categorias de produtos
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await listCategories();
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao listar categorias';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/products/categories
 * Cria uma nova categoria de produto (exige autenticação)
 */
router.post('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body || {};
    const category = await createCategory(name, color);
    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao criar categoria';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * GET /api/products/barcode/:barcode
 * Busca rápida por leitor de código de barras
 */
router.get('/barcode/:barcode', async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;
    const product = await getProductByBarcodeOrId(barcode);

    if (!product) {
      res.status(404).json({
        success: false,
        error: `Produto com código de barras "${barcode}" não encontrado.`,
      });
      return;
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao buscar produto por código';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/products/:id
 * Busca produto por ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await getProductByBarcodeOrId(id);

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Produto não encontrado.',
      });
      return;
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao buscar produto';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/products
 * Cadastra um novo produto (exige autenticação)
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const product = await createProduct({
      barcode: body.barcode,
      name: body.name,
      description: body.description,
      categoryId: body.categoryId,
      unit: body.unit,
      costPrice: Number(body.costPrice) || 0,
      sellingPrice: Number(body.sellingPrice) || 0,
      stockQuantity: Number(body.stockQuantity) || 0,
      minStockAlert: Number(body.minStockAlert) || 0,
      userId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Produto cadastrado com sucesso!',
      data: product,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao cadastrar produto';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * PUT /api/products/:id
 * Atualiza um produto existente (exige autenticação)
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const updated = await updateProduct(id, {
      barcode: body.barcode,
      name: body.name,
      description: body.description,
      categoryId: body.categoryId,
      unit: body.unit,
      costPrice: body.costPrice !== undefined ? Number(body.costPrice) : undefined,
      sellingPrice: body.sellingPrice !== undefined ? Number(body.sellingPrice) : undefined,
      minStockAlert: body.minStockAlert !== undefined ? Number(body.minStockAlert) : undefined,
      isActive: body.isActive,
    });

    res.json({
      success: true,
      message: 'Produto atualizado com sucesso!',
      data: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao atualizar produto';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * POST /api/products/:id/adjust-stock
 * Movimentação auditada de estoque: Entrada, Saída ou Balanço (exige autenticação)
 */
router.post('/:id/adjust-stock', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, quantity, reason } = req.body || {};

    if (!type || !['ENTRADA', 'SAIDA', 'AJUSTE'].includes(type)) {
      res.status(400).json({
        success: false,
        error: 'Tipo de movimentação inválido. Use ENTRADA, SAIDA ou AJUSTE.',
      });
      return;
    }

    const result = await adjustProductStock(id, {
      type,
      quantity: Number(quantity),
      reason: reason || 'Movimentação manual pelo operador',
      userId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Estoque atualizado com sucesso!',
      data: result.product,
      movementId: result.movementId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao movimentar estoque';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/products/:id
 * Desativa o produto (exige autenticação)
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ok = await deleteProduct(id);

    if (!ok) {
      res.status(404).json({ success: false, error: 'Produto não encontrado.' });
      return;
    }

    res.json({
      success: true,
      message: 'Produto removido com sucesso.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao remover produto';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
