/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

/**
 * Middleware central de tratamento de erros
 * Garante que nenhuma informação confidencial, stack traces em produção
 * ou credenciais de banco vazem para o cliente HTTP.
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isProduction = env.NODE_ENV === 'production';

  // Sanitiza mensagem de erro para evitar vazamento de credenciais
  const safeMessage = (err.message || 'Ocorreu um erro interno no servidor.')
    .replace(/:[^:@/]+@/, ':***@')
    .replace(/password\s*=\s*\S+/gi, 'password=***');

  // Log seguro no servidor
  console.error(`[API Error] ${req.method} ${req.path} - Status ${statusCode}:`, safeMessage);

  res.status(statusCode).json({
    success: false,
    error: {
      message: safeMessage,
      code: err.code || 'INTERNAL_ERROR',
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}
