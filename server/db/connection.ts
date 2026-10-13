/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Cria ou retorna o pool de conexões do PostgreSQL.
 * Suporta SSL automático quando implantado no Render ou em conexões remotas.
 */
export function getDbPool(): pg.Pool | null {
  if (!env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    const isProduction = env.NODE_ENV === 'production';
    const isRender = Boolean(process.env.RENDER) || env.DATABASE_URL.includes('render.com');

    pool = new Pool({
      connectionString: env.DATABASE_URL,
      // Render PostgreSQL exige conexão SSL; em produção ativamos com segurança
      ssl: isProduction || isRender
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      // Log seguro sem expor credenciais
      console.error('[PostgreSQL Pool] Erro inesperado em cliente ocioso:', err.message);
    });
  }

  return pool;
}

export interface DatabaseHealthResult {
  configured: boolean;
  connected: boolean;
  latencyMs?: number;
  message: string;
}

/**
 * Verifica a integridade da conexão com o PostgreSQL
 * Executa uma consulta leve de ping (SELECT 1) sem expor senhas ou host sensível.
 */
export async function checkDatabaseConnection(): Promise<DatabaseHealthResult> {
  if (!env.DATABASE_URL) {
    return {
      configured: false,
      connected: false,
      message: 'DATABASE_URL não configurada no ambiente. Conexão inativa.',
    };
  }

  const dbPool = getDbPool();
  if (!dbPool) {
    return {
      configured: false,
      connected: false,
      message: 'Falha ao inicializar o pool do banco de dados.',
    };
  }

  const startTime = Date.now();
  let client: pg.PoolClient | null = null;

  try {
    client = await dbPool.connect();
    await client.query('SELECT 1 AS health_check;');
    const latencyMs = Date.now() - startTime;

    return {
      configured: true,
      connected: true,
      latencyMs,
      message: 'Conexão com PostgreSQL estabelecida com sucesso.',
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao conectar';
    
    // Sanitiza mensagens para não expor senhas
    const sanitizedMsg = errorMessage
      .replace(/:[^:@/]+@/, ':***@')
      .replace(/password\s*=\s*\S+/gi, 'password=***');

    return {
      configured: true,
      connected: false,
      latencyMs,
      message: `Falha na conexão com PostgreSQL: ${sanitizedMsg}`,
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Encerra o pool de conexões com segurança (graceful shutdown)
 */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
