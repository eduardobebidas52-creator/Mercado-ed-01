-- ==============================================================================
-- PROJETO MERCADO - MIGRAÇÃO 004: FRENTE DE CAIXA (PDV), TURNOS E VENDAS
-- Data: Etapa 4 - Operação de Vendas e Controle de Caixa
-- Regra: Nunca utilizar comandos DROP que apaguem dados existentes.
-- ==============================================================================

-- 1. Turnos de Caixa (Abertura, Fechamento e Conferência)
CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL REFERENCES users(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    closing_balance DECIMAL(12, 2),
    expected_balance DECIMAL(12, 2),
    difference DECIMAL(12, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_operator ON cash_registers(operator_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status);

-- 2. Movimentações Avulsas de Caixa (Sangria e Suprimento)
CREATE TABLE IF NOT EXISTS cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'SUPRIMENTO', 'SANGRIA'
    amount DECIMAL(12, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    operator_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_register ON cash_transactions(cash_register_id);

-- 3. Registro de Vendas
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number SERIAL UNIQUE,
    cash_register_id UUID REFERENCES cash_registers(id) ON DELETE SET NULL,
    operator_id UUID NOT NULL REFERENCES users(id),
    subtotal DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL, -- 'DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'FIADO'
    amount_paid DECIMAL(12, 2) NOT NULL,
    change_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    customer_name VARCHAR(160),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'CANCELLED'
    cancellation_reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_operator ON sales(operator_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_register ON sales(cash_register_id);

-- 4. Itens da Venda
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
