-- ==============================================================================
-- PROJETO MERCADO - MIGRAÇÃO 002: MELHORIAS DE AUTENTICAÇÃO E SESSÃO
-- Data: Etapa 2 - Autenticação Segura e Conta do Administrador Eduardo
-- Regra: Nunca utilizar comandos DROP que apaguem dados existentes.
-- ==============================================================================

-- Adiciona coluna de registro do último login
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Adiciona telefone de contato opcional do operador/administrador
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

-- Índice para acelerar busca por status ativo
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
