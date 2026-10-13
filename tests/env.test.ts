/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { getSanitizedEnvSummary, env } from '../server/config/env.js';

describe('Configuração de Ambiente e Segurança', () => {
  it('deve retornar metadados sanitizados sem vazar senhas ou tokens', () => {
    const summary = getSanitizedEnvSummary();

    expect(summary).toHaveProperty('environment');
    expect(summary).toHaveProperty('port');
    expect(summary).toHaveProperty('hasDatabaseUrl');
    expect(summary).toHaveProperty('hasJwtSecret');

    // Garante que chaves confidenciais brutas não constam no resumo
    expect(summary).not.toHaveProperty('DATABASE_URL');
    expect(summary).not.toHaveProperty('JWT_SECRET');
  });

  it('deve ter porta válida padrão', () => {
    expect(typeof env.PORT).toBe('number');
    expect(env.PORT).toBeGreaterThan(0);
  });
});
