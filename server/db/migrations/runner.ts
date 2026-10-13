/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbPool } from '../connection.js';
import { env } from '../../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MigrationFile {
  name: string;
  filePath: string;
}

export interface MigrationReport {
  configured: boolean;
  appliedCount: number;
  pendingCount: number;
  availableMigrations: string[];
  appliedMigrations: string[];
  pendingMigrations: string[];
  message: string;
}

export const BUILTIN_MIGRATIONS: Record<string, string> = {
  '001_initial_schema.sql': `
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'operador',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(60) NOT NULL,
    user_id UUID,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`,
  '002_add_auth_enhancements.sql': `
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
`
};

/**
 * Obtém todos os arquivos de migração ordenados alfabeticamente
 */
export function getMigrationFiles(): MigrationFile[] {
  const candidates = [
    __dirname,
    path.resolve(process.cwd(), 'server/db/migrations'),
    path.resolve(__dirname, 'server/db/migrations'),
    path.resolve(__dirname, '../server/db/migrations'),
  ];

  const migrationsDir = candidates.find(dir => {
    try {
      return fs.existsSync(dir) && fs.readdirSync(dir).some(f => f.endsWith('.sql'));
    } catch {
      return false;
    }
  });

  if (migrationsDir) {
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length > 0) {
      return files.map(file => ({
        name: file,
        filePath: path.join(migrationsDir, file),
      }));
    }
  }

  // Fallback garantido para ambiente empacotado
  return Object.keys(BUILTIN_MIGRATIONS).sort().map(name => ({
    name,
    filePath: '',
  }));
}

/**
 * Consulta o status atual das migrações sem executar nenhuma alteração
 */
export async function getMigrationStatus(): Promise<MigrationReport> {
  const available = getMigrationFiles().map(f => f.name);

  if (!env.DATABASE_URL) {
    return {
      configured: false,
      appliedCount: 0,
      pendingCount: available.length,
      availableMigrations: available,
      appliedMigrations: [],
      pendingMigrations: available,
      message: 'DATABASE_URL não configurada. As migrações não podem ser checadas no banco.',
    };
  }

  const pool = getDbPool();
  if (!pool) {
    return {
      configured: false,
      appliedCount: 0,
      pendingCount: available.length,
      availableMigrations: available,
      appliedMigrations: [],
      pendingMigrations: available,
      message: 'Pool de banco de dados indisponível.',
    };
  }

  try {
    const client = await pool.connect();
    try {
      // Garante que a tabela _migrations existe para verificação
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      const res = await client.query<{ name: string }>('SELECT name FROM _migrations ORDER BY id ASC;');
      const applied = res.rows.map(r => r.name);
      const pending = available.filter(name => !applied.includes(name));

      return {
        configured: true,
        appliedCount: applied.length,
        pendingCount: pending.length,
        availableMigrations: available,
        appliedMigrations: applied,
        pendingMigrations: pending,
        message: pending.length === 0
          ? 'Todas as migrações estão aplicadas e sincronizadas.'
          : `Existem ${pending.length} migrações pendentes para execução.`,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      configured: true,
      appliedCount: 0,
      pendingCount: available.length,
      availableMigrations: available,
      appliedMigrations: [],
      pendingMigrations: available,
      message: `Não foi possível verificar status no banco: ${errMessage}`,
    };
  }
}

/**
 * Executa todas as migrações pendentes em transações seguras
 */
export async function runMigrations(): Promise<{ success: boolean; executed: string[]; error?: string }> {
  if (!env.DATABASE_URL) {
    return {
      success: false,
      executed: [],
      error: 'DATABASE_URL não configurada no ambiente.',
    };
  }

  const pool = getDbPool();
  if (!pool) {
    return {
      success: false,
      executed: [],
      error: 'Pool do banco de dados não foi inicializado.',
    };
  }

  const migrationFiles = getMigrationFiles();
  const executed: string[] = [];

  const client = await pool.connect();
  try {
    // 1. Cria tabela de migrações se não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Busca migrações já aplicadas
    const res = await client.query<{ name: string }>('SELECT name FROM _migrations;');
    const applied = new Set(res.rows.map(r => r.name));

    // 3. Executa cada migração pendente dentro de uma transação
    for (const migration of migrationFiles) {
      if (!applied.has(migration.name)) {
        console.log(`[Migrações] Executando migração: ${migration.name}`);
        const sql = migration.filePath && fs.existsSync(migration.filePath)
          ? fs.readFileSync(migration.filePath, 'utf-8')
          : BUILTIN_MIGRATIONS[migration.name];

        if (!sql) {
          console.warn(`[Migrações] Conteúdo não encontrado para ${migration.name}, ignorando.`);
          continue;
        }

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO _migrations (name) VALUES ($1);', [migration.name]);
          await client.query('COMMIT');
          executed.push(migration.name);
          console.log(`[Migrações] Sucesso ao aplicar: ${migration.name}`);
        } catch (migError) {
          await client.query('ROLLBACK');
          const msg = migError instanceof Error ? migError.message : String(migError);
          console.error(`[Migrações] Erro ao aplicar ${migration.name}. Rollback executado:`, msg);
          return {
            success: false,
            executed,
            error: `Erro ao aplicar ${migration.name}: ${msg}`,
          };
        }
      }
    }

    return {
      success: true,
      executed,
    };
  } finally {
    client.release();
  }
}

// Execução direta via CLI (npm run migrate)
const isDirectMigrationScript = Boolean(
  process.argv[1] && (
    process.argv[1].endsWith('runner.ts') ||
    process.argv[1].endsWith('runner.js')
  )
);

if (isDirectMigrationScript) {
  console.log('[Migrações] Iniciando executor de migrações versionadas do Mercado...');
  runMigrations()
    .then((result) => {
      if (result.success) {
        console.log(`[Migrações] Concluído com sucesso. Executadas: ${result.executed.length}`);
        process.exit(0);
      } else {
        console.error('[Migrações] Falha no processo:', result.error);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('[Migrações] Erro fatal:', err);
      process.exit(1);
    });
}
