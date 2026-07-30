-- Migration: Adiciona colunas financeiras em ml_orders
-- Versão idempotente (pode rodar várias vezes sem erro)

-- 1. Adiciona colunas financeiras em ml_orders
ALTER TABLE public.ml_orders
ADD COLUMN IF NOT EXISTS coupon_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS overpaid_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 2. Index para performance
CREATE INDEX IF NOT EXISTS idx_ml_orders_status ON public.ml_orders(status);
CREATE INDEX IF NOT EXISTS idx_ml_orders_date_created ON public.ml_orders(date_created DESC);