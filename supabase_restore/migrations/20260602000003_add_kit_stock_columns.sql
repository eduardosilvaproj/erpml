-- Migration: Adicionar campos de estoque na tabela product_kits
-- Data: 2026-06-02
-- Executar no SQL Editor do Supabase

-- Adicionar colunas se não existirem
ALTER TABLE product_kits
ADD COLUMN IF NOT EXISTS stock_physical INTEGER DEFAULT 0;

ALTER TABLE product_kits
ADD COLUMN IF NOT EXISTS stock_full INTEGER DEFAULT 0;

ALTER TABLE product_kits
ADD COLUMN IF NOT EXISTS stock_reserved INTEGER DEFAULT 0;

ALTER TABLE product_kits
ADD COLUMN IF NOT EXISTS cost DECIMAL(12,2) DEFAULT 0;

ALTER TABLE product_kits
ADD COLUMN IF NOT EXISTS stock_min INTEGER DEFAULT 0;