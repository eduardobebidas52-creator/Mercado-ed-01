/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'gerente' | 'operador';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware para proteção de rotas privadas via token Bearer.
 * Na Etapa 1, define a infraestrutura e rejeita requisições não autorizadas.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Acesso restrito. Token de autenticação Bearer não fornecido.',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.trim().length === 0) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token de autenticação inválido ou vazio.',
      },
    });
    return;
  }

  if (!env.JWT_SECRET) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_MISCONFIGURED',
        message: 'Chave secreta JWT não configurada no servidor.',
      },
    });
    return;
  }

  // A validação completa com verificação criptográfica e decodificação do payload
  // será conectada na etapa de autenticação após criação do login do administrador.
  next();
}

/**
 * Middleware para autorização baseada em cargos (RBAC)
 */
export function requireRole(allowedRoles: Array<'admin' | 'gerente' | 'operador'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Usuário não autenticado.',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Acesso negado: permissão insuficiente para este recurso.',
        },
      });
      return;
    }

    next();
  };
}
