/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';

const apiRouter = Router();

// Rota base de saúde e diagnóstico
apiRouter.use('/health', healthRoutes);

// Rotas de autenticação e contas
apiRouter.use('/auth', authRoutes);

// Tratamento de rotas inexistentes dentro de /api/*
apiRouter.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Rota ${req.originalUrl} não encontrada no backend do Mercado.`,
    },
  });
});

export default apiRouter;
