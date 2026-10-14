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
`,
  '003_products_and_categories.sql': `
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL UNIQUE,
    color VARCHAR(20) DEFAULT '#2563eb',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO categories (name, color) VALUES
    ('Bebidas', '#0284c7'),
    ('Mercearia', '#ea580c'),
    ('Laticínios & Frios', '#eab308'),
    ('Higiene & Beleza', '#ec4899'),
    ('Limpeza', '#10b981'),
    ('Hortifrúti', '#16a34a'),
    ('Padaria & Confeitaria', '#d97706'),
    ('Carnes & Açougue', '#dc2626'),
    ('Doces & Bomboniere', '#8b5cf6'),
    ('Outros', '#64748b')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode VARCHAR(64) UNIQUE,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    unit VARCHAR(10) NOT NULL DEFAULT 'UN',
    cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    stock_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    min_stock_alert DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL,
    previous_stock DECIMAL(12, 3) NOT NULL,
    new_stock DECIMAL(12, 3) NOT NULL,
    reason VARCHAR(255),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
`,
  '004_pos_and_cash_registers.sql': `
CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL REFERENCES users(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    closing_balance DECIMAL(12, 2),
    expected_balance DECIMAL(12, 2),
    difference DECIMAL(12, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_operator ON cash_registers(operator_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status);

CREATE TABLE IF NOT EXISTS cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    operator_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_register ON cash_transactions(cash_register_id);

CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number SERIAL UNIQUE,
    cash_register_id UUID REFERENCES cash_registers(id) ON DELETE SET NULL,
    operator_id UUID NOT NULL REFERENCES users(id),
    subtotal DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    amount_paid DECIMAL(12, 2) NOT NULL,
    change_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    customer_name VARCHAR(160),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    cancellation_reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_operator ON sales(operator_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_register ON sales(cash_register_id);

CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name VARCHAR(160) NOT NULL,
    barcode VARCHAR(64),
    unit VARCHAR(10) NOT NULL DEFAULT 'UN',
    quantity DECIMAL(12, 3) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
`,
  '005_batches_and_alerts.sql': `
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(80);
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(120);
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_validity_control BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ideal_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000;

CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_name);

CREATE TABLE IF NOT EXISTS product_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number VARCHAR(60) NOT NULL,
    expiration_date DATE NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    supplier_name VARCHAR(120),
    is_checked BOOLEAN NOT NULL DEFAULT false,
    checked_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiration ON product_batches(expiration_date);
CREATE INDEX IF NOT EXISTS idx_product_batches_status ON product_batches(status);
CREATE INDEX IF NOT EXISTS idx_product_batches_checked ON product_batches(is_checked);

CREATE TABLE IF NOT EXISTS alert_settings (
    id SERIAL PRIMARY KEY,
    yellow_days_threshold INT NOT NULL DEFAULT 30,
    orange_days_threshold INT NOT NULL DEFAULT 7,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO alert_settings (id, yellow_days_threshold, orange_days_threshold)
VALUES (1, 30, 7)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS waste_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
    quantity DECIMAL(12, 3) NOT NULL,
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_loss DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    reason VARCHAR(60) NOT NULL DEFAULT 'VENCIDO',
    notes TEXT,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waste_records_product ON waste_records(product_id);
CREATE INDEX IF NOT EXISTS idx_waste_records_created ON waste_records(created_at);
CREATE INDEX IF NOT EXISTS idx_waste_records_reason ON waste_records(reason);
`,
  '006_customers_and_credit.sql': `
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(160) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    cpf VARCHAR(20),
    address TEXT,
    credit_limit DECIMAL(12, 2) NOT NULL DEFAULT 500.00,
    current_debt DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);

CREATE TABLE IF NOT EXISTS customer_debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    original_amount DECIMAL(12, 2) NOT NULL,
    paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    remaining_amount DECIMAL(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_debts_customer ON customer_debts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_debts_status ON customer_debts(status);
CREATE INDEX IF NOT EXISTS idx_customer_debts_due_date ON customer_debts(due_date);
CREATE INDEX IF NOT EXISTS idx_customer_debts_sale ON customer_debts(sale_id);

CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number SERIAL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    debt_id UUID REFERENCES customer_debts(id) ON DELETE SET NULL,
    cash_register_id UUID REFERENCES cash_registers(id) ON DELETE SET NULL,
    operator_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    previous_debt DECIMAL(12, 2) NOT NULL,
    remaining_debt DECIMAL(12, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_customer ON debt_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_operator ON debt_payments(operator_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_created_at ON debt_payments(created_at);
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
