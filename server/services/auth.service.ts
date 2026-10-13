/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDbPool } from '../db/connection.js';
import { env } from '../config/env.js';
import { runMigrations } from '../db/migrations/runner.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'gerente' | 'operador';
  createdAt?: string;
  lastLoginAt?: string;
}

export interface SetupStatus {
  isInitialized: boolean;
  hasDatabase: boolean;
  adminName?: string;
  message: string;
}

/**
 * Consulta se o sistema já possui o administrador configurado
 */
export async function getSetupStatus(): Promise<SetupStatus> {
  const pool = getDbPool();
  if (!pool) {
    return {
      isInitialized: false,
      hasDatabase: false,
      adminName: 'Eduardo',
      message: 'Banco de dados PostgreSQL não conectado. Configure o DATABASE_URL para continuar.',
    };
  }

  try {
    // Garante automaticamente que as migrações do banco foram aplicadas
    await runMigrations().catch((err) => {
      console.warn('[AuthService] Auto-migração em getSetupStatus:', err);
    });

    const res = await pool.query<{ count: string }>(`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'users';
    `);

    if (Number(res.rows[0]?.count) === 0) {
      // Tabela users ainda não criada
      return {
        isInitialized: false,
        hasDatabase: true,
        adminName: 'Eduardo',
        message: 'Tabelas do sistema aguardando execução de migrações.',
      };
    }

    const userCountRes = await pool.query<{ count: string }>('SELECT count(*) as count FROM users;');
    const count = Number(userCountRes.rows[0]?.count || 0);

    return {
      isInitialized: count > 0,
      hasDatabase: true,
      adminName: 'Eduardo',
      message: count === 0
        ? 'Sistema aguardando primeiro acesso do administrador Eduardo.'
        : 'Administrador já configurado.',
    };
  } catch (error) {
    const err = error instanceof Error ? error.message : 'Erro ao consultar banco';
    return {
      isInitialized: false,
      hasDatabase: false,
      adminName: 'Eduardo',
      message: `Diagnóstico do banco: ${err}`,
    };
  }
}

/**
 * Cria a conta inicial do Administrador Eduardo com hash de senha seguro
 */
export async function setupInitialAdmin(data: {
  name: string;
  email: string;
  password: string;
  ipAddress?: string;
}): Promise<{ user: AuthUser; token: string }> {
  const pool = getDbPool();
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL não conectado.');
  }

  // Garante que o esquema e as tabelas existam no banco
  await runMigrations().catch((err) => {
    console.warn('[AuthService] Auto-migração em setupInitialAdmin:', err);
  });

  // 1. Verifica se já existe algum usuário no sistema
  const existingUsers = await pool.query<{ count: string }>('SELECT count(*) as count FROM users;');
  if (Number(existingUsers.rows[0]?.count || 0) > 0) {
    throw new Error('A inicialização já foi concluída. O administrador já existe no sistema.');
  }

  // 2. Validações estritas de senha
  if (!data.password || data.password.length < 8) {
    throw new Error('A senha do administrador deve conter no mínimo 8 caracteres.');
  }

  const safeName = data.name.trim() || 'Eduardo';
  const safeEmail = data.email.trim().toLowerCase();

  if (!safeEmail.includes('@') || !safeEmail.includes('.')) {
    throw new Error('Formato de e-mail inválido.');
  }

  // 3. Geração de hash com salt seguro (bcrypt 10 rounds)
  const passwordHash = await bcrypt.hash(data.password, 10);

  // 4. Inserção do administrador
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertUserRes = await client.query<{
      id: string;
      name: string;
      email: string;
      role: 'admin' | 'gerente' | 'operador';
      created_at: string;
    }>(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'admin', true)
       RETURNING id, name, email, role, created_at;`,
      [safeName, safeEmail, passwordHash]
    );

    const createdUser = insertUserRes.rows[0];

    // Registra evento de auditoria
    await client.query(
      `INSERT INTO audit_logs (event_type, user_id, details, ip_address)
       VALUES ('INITIAL_ADMIN_CREATED', $1, $2, $3);`,
      [createdUser.id, JSON.stringify({ name: safeName, email: safeEmail }), data.ipAddress || null]
    );

    await client.query('COMMIT');

    const user: AuthUser = {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      createdAt: createdUser.created_at,
    };

    const token = generateAuthToken(user);

    return { user, token };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Autentica o usuário com email e senha
 */
export async function loginUser(data: {
  email: string;
  password: string;
  ipAddress?: string;
}): Promise<{ user: AuthUser; token: string }> {
  const pool = getDbPool();
  if (!pool) {
    throw new Error('Banco de dados PostgreSQL não conectado.');
  }

  const safeEmail = (data.email || '').trim().toLowerCase();
  if (!safeEmail || !data.password) {
    throw new Error('Informe o e-mail e a senha.');
  }

  const res = await pool.query<{
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: 'admin' | 'gerente' | 'operador';
    is_active: boolean;
  }>(
    `SELECT id, name, email, password_hash, role, is_active
     FROM users
     WHERE LOWER(email) = $1;`,
    [safeEmail]
  );

  const foundUser = res.rows[0];

  // Resposta genérica para evitar enumeração de contas
  if (!foundUser || !foundUser.is_active) {
    throw new Error('E-mail ou senha incorretos.');
  }

  const passwordMatches = await bcrypt.compare(data.password, foundUser.password_hash);
  if (!passwordMatches) {
    throw new Error('E-mail ou senha incorretos.');
  }

  // Atualiza último login e loga auditoria
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1;', [foundUser.id]);
  await pool.query(
    `INSERT INTO audit_logs (event_type, user_id, ip_address)
     VALUES ('USER_LOGIN_SUCCESS', $1, $2);`,
    [foundUser.id, data.ipAddress || null]
  );

  const user: AuthUser = {
    id: foundUser.id,
    name: foundUser.name,
    email: foundUser.email,
    role: foundUser.role,
  };

  const token = generateAuthToken(user);

  return { user, token };
}

/**
 * Gera um token JWT seguro assinado com a chave do servidor
 */
export function generateAuthToken(user: AuthUser): string {
  const secret = env.JWT_SECRET || 'dev_secret_mercado_12345';
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    secret,
    {
      expiresIn: '8h',
    }
  );
}

/**
 * Valida e decodifica um token JWT
 */
export function verifyAuthToken(token: string): AuthUser {
  const secret = env.JWT_SECRET || 'dev_secret_mercado_12345';
  const decoded = jwt.verify(token, secret) as {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'gerente' | 'operador';
  };

  return {
    id: decoded.id,
    name: decoded.name,
    email: decoded.email,
    role: decoded.role,
  };
}
