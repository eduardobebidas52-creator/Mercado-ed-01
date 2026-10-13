/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import { 
  getSetupStatus, 
  setupInitialAdmin, 
  loginUser 
} from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/auth/setup-status
 * Verifica se o administrador Eduardo já foi configurado
 */
router.get('/setup-status', async (req: Request, res: Response) => {
  try {
    const status = await getSetupStatus();
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao verificar status';
    res.status(500).json({
      error: 'Erro ao verificar inicialização',
      details: message,
    });
  }
});

/**
 * POST /api/auth/setup-initial-admin
 * Cadastro único inicial do Administrador Eduardo
 */
router.post('/setup-initial-admin', async (req: Request, res: Response) => {
  try {
    const { name, email, password, confirmPassword } = req.body || {};

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Preencha o e-mail e a senha do administrador.',
        },
      });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({
        success: false,
        error: {
          code: 'PASSWORDS_DO_NOT_MATCH',
          message: 'As senhas digitadas não coincidem.',
        },
      });
      return;
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const result = await setupInitialAdmin({
      name: name || 'Eduardo',
      email,
      password,
      ipAddress,
    });

    res.status(201).json({
      success: true,
      message: 'Administrador Eduardo cadastrado com sucesso!',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao cadastrar administrador.';
    res.status(400).json({
      success: false,
      error: {
        code: 'SETUP_FAILED',
        message,
      },
    });
  }
});

/**
 * POST /api/auth/login
 * Autenticação com e-mail e senha
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await loginUser({
      email,
      password,
      ipAddress,
    });

    res.json({
      success: true,
      message: 'Login realizado com sucesso.',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na autenticação.';
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_FAILED',
        message,
      },
    });
  }
});

/**
 * GET /api/auth/me
 * Retorna os dados do usuário autenticado no token
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/logout
 * Encerramento de sessão
 */
router.post('/logout', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Sessão encerrada com sucesso.',
  });
});

export default router;
