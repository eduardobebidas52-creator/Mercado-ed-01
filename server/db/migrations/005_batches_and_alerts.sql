-- ==============================================================================
-- PROJETO MERCADO - MIGRAÇÃO 005: LOTES DE PRODUTOS, CONTROLE DE VALIDADE E ALERTAS
-- Data: Etapa 5 - Alerta de Validade e Alerta de Estoque
-- Regra: Nunca utilizar comandos DROP que apaguem dados existentes.
-- ==============================================================================

-- 1. Ampliação da tabela de produtos com campos de marca, fornecedor, estoque ideal e controle de validade
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(80);
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(120);
ALTER TABLE products ADD COLUMN IF NOT EXISTS has_validity_control BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ideal_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000;

CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_name);

-- 2. Tabela de Lotes de Produtos (Gestão de Validade Real por Lote)
CREATE TABLE IF NOT EXISTS product_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number VARCHAR(60) NOT NULL,
    expiration_date DATE NOT NULL,
    quantity DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    supplier_name VARCHAR(120),
    is_checked BOOLEAN NOT NULL DEFAULT false,
    checked_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'DISCARDED', 'EXHAUSTED'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiration ON product_batches(expiration_date);
CREATE INDEX IF NOT EXISTS idx_product_batches_status ON product_batches(status);
CREATE INDEX IF NOT EXISTS idx_product_batches_checked ON product_batches(is_checked);

-- 3. Configurações dos períodos de alerta de validade
CREATE TABLE IF NOT EXISTS alert_settings (
    id SERIAL PRIMARY KEY,
    yellow_days_threshold INT NOT NULL DEFAULT 30,
    orange_days_threshold INT NOT NULL DEFAULT 7,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insere configuração padrão se não existir
INSERT INTO alert_settings (id, yellow_days_threshold, orange_days_threshold)
VALUES (1, 30, 7)
ON CONFLICT (id) DO NOTHING;

-- 4. Tabela de Registro de Perdas, Avarias e Baixas por Validade Vencida
CREATE TABLE IF NOT EXISTS waste_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
    quantity DECIMAL(12, 3) NOT NULL,
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_loss DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    reason VARCHAR(60) NOT NULL DEFAULT 'VENCIDO', -- 'VENCIDO', 'AVARIA', 'PERDA', 'OUTRO'
    notes TEXT,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waste_records_product ON waste_records(product_id);
CREATE INDEX IF NOT EXISTS idx_waste_records_created ON waste_records(created_at);
CREATE INDEX IF NOT EXISTS idx_waste_records_reason ON waste_records(reason);
