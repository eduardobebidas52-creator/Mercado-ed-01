-- ==============================================================================
-- PROJETO MERCADO - MIGRAÇÃO 001: ESTRUTURA BASE E TABELA DE MIGRAÇÕES
-- Data: Etapa 1 - Arquitetura e Estrutura Inicial
-- Regra: Nunca utilizar comandos DROP que apaguem dados existentes.
-- ==============================================================================

-- Tabela de controle de migrações versionadas
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilita extensão para geração de UUID caso disponível
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela de Usuários e Permissões (RBAC)
-- Preparada para autenticação segura. Nenhuma senha padrão insegura ou previsível é inserida.
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'operador', -- 'admin', 'gerente', 'operador'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de Auditoria e Segurança de Acesso
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(80) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    details JSONB,
    ip_address VARCHAR(60),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices essenciais para desempenho e integridade
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
