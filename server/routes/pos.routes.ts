/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { 
  getCurrentCashRegister, 
  openCashRegister, 
  closeCashRegister, 
  addCashTransaction, 
  createSale, 
  cancelSale, 
  listSales, 
  getTodaySalesMetrics 
} from '../services/pos.service.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Todas as rotas de PDV exigem autenticação do operador
router.use(requireAuth);

/**
 * GET /api/pos/register/current
 * Consulta o caixa aberto do operador autenticado
 */
router.get('/register/current', async (req: Request, res: Response) => {
  try {
    const register = await getCurrentCashRegister(req.user?.id);
    res.json({
      success: true,
      data: register,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao consultar caixa';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/pos/register/open
 * Abertura de caixa com saldo inicial
 */
router.post('/register/open', async (req: Request, res: Response) => {
  try {
    const { initialBalance, notes } = req.body || {};
    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'Operador não identificado.' });
      return;
    }

    const register = await openCashRegister(req.user.id, Number(initialBalance) || 0, notes);
    res.status(201).json({
      success: true,
      message: 'Caixa aberto com sucesso!',
      data: register,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao abrir caixa';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * POST /api/pos/register/close
 * Fechamento de caixa com conferência cega
 */
router.post('/register/close', async (req: Request, res: Response) => {
  try {
    const { registerId, countedBalance, notes } = req.body || {};
    if (!req.user?.id || !registerId) {
      res.status(400).json({ success: false, error: 'Identificação de caixa inválida.' });
      return;
    }

    const register = await closeCashRegister(
      registerId,
      req.user.id,
      Number(countedBalance) || 0,
      notes
    );

    res.json({
      success: true,
      message: 'Caixa fechado com sucesso!',
      data: register,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao fechar caixa';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * POST /api/pos/register/transaction
 * Registro de sangria ou suprimento de caixa
 */
router.post('/register/transaction', async (req: Request, res: Response) => {
  try {
    const { registerId, type, amount, reason } = req.body || {};
    if (!req.user?.id || !registerId) {
      res.status(400).json({ success: false, error: 'Identificação de caixa inválida.' });
      return;
    }

    if (!type || !['SUPRIMENTO', 'SANGRIA'].includes(type)) {
      res.status(400).json({ success: false, error: 'Tipo inválido. Use SUPRIMENTO ou SANGRIA.' });
      return;
    }

    const tx = await addCashTransaction(
      registerId,
      req.user.id,
      type,
      Number(amount),
      reason
    );

    res.status(201).json({
      success: true,
      message: `${type === 'SANGRIA' ? 'Sangria' : 'Suprimento'} registrado com sucesso!`,
      data: tx,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na movimentação de caixa';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * POST /api/pos/sales
 * Finalização de venda com baixa atômica de estoque
 */
router.post('/sales', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'Operador não identificado.' });
      return;
    }

    const sale = await createSale({
      operatorId: req.user.id,
      registerId: body.registerId,
      items: body.items || [],
      discount: Number(body.discount) || 0,
      paymentMethod: body.paymentMethod,
      amountPaid: Number(body.amountPaid) || 0,
      customerName: body.customerName,
      customerId: body.customerId,
      dueDate: body.dueDate,
    });

    res.status(201).json({
      success: true,
      message: 'Venda finalizada com sucesso!',
      data: sale,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao finalizar venda';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * GET /api/pos/sales
 * Lista histórico de vendas
 */
router.get('/sales', async (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;
    const sales = await listSales({
      status: typeof status === 'string' ? status : undefined,
      limit: limit ? Number(limit) : 50,
    });

    res.json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao listar vendas';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/pos/sales/:id/cancel
 * Cancelamento auditado de venda com estorno no estoque
 */
router.post('/sales/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'Operador não identificado.' });
      return;
    }

    const sale = await cancelSale(id, req.user.id, reason);
    res.json({
      success: true,
      message: `Venda #${sale.saleNumber} cancelada e estoque estornado!`,
      data: sale,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao cancelar venda';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * GET /api/pos/metrics/today
 * Métricas de vendas de hoje
 */
router.get('/metrics/today', async (req: Request, res: Response) => {
  try {
    const metrics = await getTodaySalesMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao obter métricas de hoje';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
