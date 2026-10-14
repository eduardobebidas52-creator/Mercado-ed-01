/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../services/customers.service.js';
import { requireAuth } from '../middleware/auth.js';

export const customersRouter = Router();

/**
 * GET /api/customers
 * Lista clientes com busca, filtros de fiado e indicadores
 */
customersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const hasDebtOnly = req.query.hasDebtOnly === 'true';
    const overdueOnly = req.query.overdueOnly === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const data = await listCustomers({
      search,
      status,
      hasDebtOnly,
      overdueOnly,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: data.customers,
      total: data.total,
      summary: data.summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao listar clientes.',
    });
  }
});

/**
 * GET /api/customers/:id
 * Retorna ficha completa do cliente (dados, dívidas, pagamentos e compras)
 */
customersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const data = await getCustomerById(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: 'Cliente não encontrado.' });
      return;
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar cliente.',
    });
  }
});

/**
 * POST /api/customers
 * Cadastra novo cliente (autenticado)
 */
customersRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, phone, cpf, address, creditLimit, status, notes } = req.body;
    const customer = await createCustomer({
      name,
      phone,
      cpf,
      address,
      creditLimit,
      status,
      notes,
    });

    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao cadastrar cliente.',
    });
  }
});

/**
 * PUT /api/customers/:id
 * Atualiza cliente (autenticado)
 */
customersRouter.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, phone, cpf, address, creditLimit, status, notes } = req.body;
    const customer = await updateCustomer(req.params.id, {
      name,
      phone,
      cpf,
      address,
      creditLimit,
      status,
      notes,
    });

    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao atualizar cliente.',
    });
  }
});

/**
 * DELETE /api/customers/:id
 * Remove cliente se não possuir saldo devedor (autenticado)
 */
customersRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await deleteCustomer(req.params.id);
    res.json({ success: true, message: 'Cliente removido com sucesso.' });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao remover cliente.',
    });
  }
});
