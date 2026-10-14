/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import {
  getCreditAlerts,
  getCreditAlertCounts,
  listDebts,
  receiveDebtPayment,
  listPaymentReceipts,
} from '../services/credit.service.js';
import { requireAuth } from '../middleware/auth.js';

export const creditRouter = Router();

/**
 * GET /api/credit/alerts
 * Retorna dados detalhados para a Aba "Alerta de Fiado" (Vencidos, 7 dias, Limite Estourado, Inadimplência)
 */
creditRouter.get('/alerts', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as 'ALL' | 'OVERDUE' | '7_DAYS' | 'LIMIT_EXCEEDED' | undefined;
    const search = req.query.search as string | undefined;
    const customerId = req.query.customerId as string | undefined;

    const result = await getCreditAlerts({
      status,
      search,
      customerId,
    });

    res.json({
      success: true,
      data: result.alerts,
      summary: result.summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar alertas de fiado.',
    });
  }
});

/**
 * GET /api/credit/counts
 * Contadores rápidos para badge do menu e cards
 */
creditRouter.get('/counts', async (_req: Request, res: Response) => {
  try {
    const counts = await getCreditAlertCounts();
    res.json({ success: true, data: counts });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao calcular contadores de fiado.',
    });
  }
});

/**
 * GET /api/credit/debts
 * Lista títulos de fiado para a aba "Fiado e Recebimentos"
 */
creditRouter.get('/debts', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const customerId = req.query.customerId as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const data = await listDebts({
      status,
      customerId,
      search,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: data.debts,
      total: data.total,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar contas de fiado.',
    });
  }
});

/**
 * POST /api/credit/payments
 * Realiza pagamento de fiado (parcial ou total) com emissão de recibo
 */
creditRouter.post('/payments', requireAuth, async (req: Request, res: Response) => {
  try {
    const operatorId = (req as any).user?.id;
    if (!operatorId) {
      res.status(401).json({ success: false, error: 'Operador não identificado.' });
      return;
    }

    const { customerId, debtId, amount, paymentMethod, notes } = req.body;

    if (!customerId) {
      res.status(400).json({ success: false, error: 'Identifique o cliente para o pagamento.' });
      return;
    }

    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ success: false, error: 'Valor de pagamento inválido.' });
      return;
    }

    const receipt = await receiveDebtPayment({
      customerId,
      debtId,
      amount: Number(amount),
      paymentMethod: paymentMethod || 'DINHEIRO',
      operatorId,
      notes,
    });

    res.status(201).json({
      success: true,
      data: receipt,
      message: 'Pagamento de fiado registrado e recibo gerado com sucesso.',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao registrar pagamento de fiado.',
    });
  }
});

/**
 * GET /api/credit/receipts
 * Histórico de recibos emitidos
 */
creditRouter.get('/receipts', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const data = await listPaymentReceipts({
      search,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: data.receipts,
      total: data.total,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao listar histórico de recibos.',
    });
  }
});
