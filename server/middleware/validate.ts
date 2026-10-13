/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';

export type ValidationRule = (data: unknown) => { valid: boolean; message?: string };

/**
 * Validador genérico para corpos de requisição HTTP
 */
export function validateBody(rules: Record<string, ValidationRule>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, string> = {};
    const body = (req.body || {}) as Record<string, unknown>;

    for (const [field, validator] of Object.entries(rules)) {
      const result = validator(body[field]);
      if (!result.valid) {
        errors[field] = result.message || `Campo '${field}' inválido.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Falha na validação dos dados enviados.',
          details: errors,
        },
      });
      return;
    }

    next();
  };
}
