/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { getSystemHealth } from '../services/health.service.js';
import { getMigrationStatus } from '../db/migrations/runner.js';
import { getSanitizedEnvSummary } from '../config/env.js';

const router = Router();

/**
 * GET /api/health
 * Retorna status de saúde do servidor e da conexão PostgreSQL
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const health = await getSystemHealth();
    // Retorna HTTP 200 sempre com o status (ou 503 se o orquestrador exigir)
    res.status(health.status === 'healthy' ? 200 : 200).json(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha interna no health check';
    res.status(500).json({
      service: 'Mercado API',
      status: 'error',
      message: 'Falha crítica ao obter diagnóstico do sistema.',
      details: message,
    });
  }
});

/**
 * GET /api/health/migrations
 * Retorna o status das migrações do banco de dados (quantas aplicadas, quantas pendentes)
 */
router.get('/migrations', async (req: Request, res: Response) => {
  try {
    const status = await getMigrationStatus();
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao checar migrações';
    res.status(500).json({
      error: 'Falha ao checar status das migrações.',
      details: message,
    });
  }
});

/**
 * GET /api/health/config
 * Retorna o resumo das configurações ativas no ambiente (apenas metadados seguros)
 */
router.get('/config', (req: Request, res: Response) => {
  res.json({
    config: getSanitizedEnvSummary(),
    note: 'Nenhuma credencial ou segredo sensível é exposto nesta rota.',
  });
});

export default router;
