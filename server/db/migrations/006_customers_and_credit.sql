-- ==============================================================================
-- PROJETO MERCADO - MIGRAÇÃO 006: GESTÃO DE CLIENTES, CONTROLE DE FIADO E RECEBIMENTOS
-- Data: Etapa 6 - Clientes, Alerta de Fiado e Baixa de Recebimentos
-- Regra: Nunca utilizar comandos DROP que apaguem dados existentes.
-- ==============================================================================

-- 1. Cadastro de Clientes
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(160) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    cpf VARCHAR(20),
    address TEXT,
    credit_limit DECIMAL(12, 2) NOT NULL DEFAULT 500.00,
    current_debt DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'BLOCKED'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- 2. Vínculo de Cliente na tabela de Vendas
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);

-- 3. Contas de Fiado / Títulos a Receber de Clientes
CREATE TABLE IF NOT EXISTS customer_debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    original_amount DECIMAL(12, 2) NOT NULL,
    paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    remaining_amount DECIMAL(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_debts_customer ON customer_debts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_debts_status ON customer_debts(status);
CREATE INDEX IF NOT EXISTS idx_customer_debts_due_date ON customer_debts(due_date);
CREATE INDEX IF NOT EXISTS idx_customer_debts_sale ON customer_debts(sale_id);

-- 4. Recebimentos e Pagamentos de Fiado (Parciais e Totais com Recibo)
CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number SERIAL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    debt_id UUID REFERENCES customer_debts(id) ON DELETE SET NULL,
    cash_register_id UUID REFERENCES cash_registers(id) ON DELETE SET NULL,
    operator_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL, -- 'DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'
    previous_debt DECIMAL(12, 2) NOT NULL,
    remaining_debt DECIMAL(12, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_customer ON debt_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_operator ON debt_payments(operator_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_created_at ON debt_payments(created_at);
