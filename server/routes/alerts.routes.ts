/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import {
  getAlertCounts,
  listExpiryAlerts,
  createProductBatch,
  markBatchChecked,
  registerBatchLoss,
  listStockAlerts,
  generateShoppingList,
  getAlertSettings,
  updateAlertSettings,
  seedDemoBatches,
} from '../services/alerts.service.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/alerts/counts
 * Contadores em tempo real para menu lateral e dashboard
 */
router.get('/counts', async (req: Request, res: Response) => {
  try {
    const counts = await getAlertCounts();
    res.json({
      success: true,
      data: counts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao buscar contadores de alerta';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/alerts/expiry
 * Listagem dos alertas de validade com status e dias restantes
 */
router.get('/expiry', async (req: Request, res: Response) => {
  try {
    const { status, categoryId, search } = req.query;
    const alerts = await listExpiryAlerts({
      status: typeof status === 'string' ? (status as any) : undefined,
      categoryId: typeof categoryId === 'string' ? categoryId : undefined,
      search: typeof search === 'string' ? search : undefined,
    });

    res.json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao buscar alertas de validade';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/alerts/expiry/batch
 * Cadastro de novo lote com validade associado a um produto
 */
router.post('/expiry/batch', requireAuth, async (req: Request, res: Response) => {
  try {
    const { productId, batchNumber, expirationDate, quantity, supplierName, notes, addToStock } = req.body || {};

    if (!productId || !batchNumber || !expirationDate || quantity === undefined) {
      res.status(400).json({
        success: false,
        error: 'Preencha o produto, número do lote, data de validade e quantidade.',
      });
      return;
    }

    const batch = await createProductBatch({
      productId,
      batchNumber,
      expirationDate,
      quantity: Number(quantity),
      supplierName,
      notes,
      addToStock: Boolean(addToStock),
      userId: req.user?.id,
    });

    res.status(201).json({
      success: true,
      message: 'Lote de produto cadastrado com sucesso!',
      data: batch,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao cadastrar lote';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * PATCH /api/alerts/expiry/:batchId/check
 * Marca ou desmarca o lote como conferido pelo operador
 */
router.patch('/expiry/:batchId/check', requireAuth, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { isChecked } = req.body || {};

    const ok = await markBatchChecked(batchId, isChecked !== false);
    if (!ok) {
      res.status(404).json({ success: false, error: 'Lote não encontrado.' });
      return;
    }

    res.json({
      success: true,
      message: isChecked !== false ? 'Lote marcado como conferido.' : 'Lote desmarcado.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao atualizar status de conferência';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/alerts/expiry/:batchId/loss
 * Baixa de mercadoria por validade vencida ou avaria
 */
router.post('/expiry/:batchId/loss', requireAuth, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { quantity, reason, notes } = req.body || {};

    if (!quantity || Number(quantity) <= 0) {
      res.status(400).json({ success: false, error: 'Informe a quantidade válida para baixa.' });
      return;
    }

    const result = await registerBatchLoss(batchId, {
      quantity: Number(quantity),
      reason: reason || 'VENCIDO',
      notes,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      message: 'Baixa registrada e estoque atualizado com sucesso!',
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao registrar baixa de produto';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * GET /api/alerts/stock
 * Listagem dos alertas de estoque (zerados e abaixo do mínimo)
 */
router.get('/stock', async (req: Request, res: Response) => {
  try {
    const { status, categoryId, search } = req.query;
    const alerts = await listStockAlerts({
      status: typeof status === 'string' ? (status as any) : undefined,
      categoryId: typeof categoryId === 'string' ? categoryId : undefined,
      search: typeof search === 'string' ? search : undefined,
    });

    res.json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao buscar alertas de estoque';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/alerts/stock/shopping-list
 * Gera sugestão de lista de compras / reposição
 */
router.get('/stock/shopping-list', async (req: Request, res: Response) => {
  try {
    const shoppingList = await generateShoppingList();
    res.json({
      success: true,
      data: shoppingList,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao gerar lista de reposição';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/alerts/settings
 * Configuração dos limiares de alerta
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await getAlertSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao buscar configurações';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * PUT /api/alerts/settings
 * Atualização das regras de dias para os alertas de validade
 */
router.put('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const { yellowDaysThreshold, orangeDaysThreshold } = req.body || {};
    const updated = await updateAlertSettings(
      Number(yellowDaysThreshold),
      Number(orangeDaysThreshold)
    );

    res.json({
      success: true,
      message: 'Configurações de alerta atualizadas com sucesso!',
      data: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao salvar configurações';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * POST /api/alerts/seed-demo
 * Popula lotes de exemplo com diferentes validades para demonstração imediata
 */
router.post('/seed-demo', requireAuth, async (req: Request, res: Response) => {
  try {
    const inserted = await seedDemoBatches();
    res.json({
      success: true,
      message: inserted > 0 ? `${inserted} lotes de teste foram gerados com sucesso!` : 'Lotes já estavam cadastrados no banco.',
      inserted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao gerar lotes de teste';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
