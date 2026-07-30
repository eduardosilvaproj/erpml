-- Add payment-related columns to ml_orders for Mercado Livre payment webhook data
ALTER TABLE public.ml_orders
ADD COLUMN IF NOT EXISTS coupon_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS overpaid_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS payment_method TEXT;
