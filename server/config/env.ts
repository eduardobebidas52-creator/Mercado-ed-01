/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';

// Carrega variáveis do arquivo .env se existir
dotenv.config();

export interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  DATABASE_URL?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  APP_URL: string;
}

const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';

export const env: EnvConfig = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: nodeEnv,
  DATABASE_URL: process.env.DATABASE_URL || undefined,
  JWT_SECRET: process.env.JWT_SECRET || (nodeEnv === 'production' ? '' : 'dev_jwt_secret_mercado_2026_secure_key_12345'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
};

/**
 * Retorna as configurações sanitizadas para diagnóstico público/saúde
 * NUNCA expõe senhas, chaves secretas ou credenciais brutas.
 */
export function getSanitizedEnvSummary() {
  return {
    environment: env.NODE_ENV,
    port: env.PORT,
    hasDatabaseUrl: Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0),
    hasJwtSecret: Boolean(env.JWT_SECRET && env.JWT_SECRET.trim().length > 0),
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    appUrl: env.APP_URL,
  };
}
