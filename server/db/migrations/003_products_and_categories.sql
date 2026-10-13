-- ==============================================================================
-- PROJETO MERCADO - MIGRAÇÃO 003: PRODUTOS, CATEGORIAS E MOVIMENTAÇÃO DE ESTOQUE
-- Data: Etapa 3 - Cadastro de Produtos e Gestão de Estoque
-- Regra: Nunca utilizar comandos DROP que apaguem dados existentes.
-- ==============================================================================

-- 1. Tabela de Categorias de Produtos
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL UNIQUE,
    color VARCHAR(20) DEFAULT '#2563eb',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insere categorias comerciais padrão do mercado se não existirem
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

-- 2. Tabela de Produtos
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

-- Índices de alta performance para busca rápida por leitor de código de barras e nome
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- 3. Tabela de Auditoria de Movimentações de Estoque
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'ENTRADA', 'SAIDA', 'AJUSTE', 'VENDA'
    quantity DECIMAL(12, 3) NOT NULL,
    previous_stock DECIMAL(12, 3) NOT NULL,
    new_stock DECIMAL(12, 3) NOT NULL,
    reason VARCHAR(255),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
