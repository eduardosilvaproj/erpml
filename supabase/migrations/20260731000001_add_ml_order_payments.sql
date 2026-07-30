-- Ensure ml_orders table exists before adding payment columns
CREATE TABLE IF NOT EXISTS public.ml_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ml_order_id TEXT NOT NULL UNIQUE,
  date_created TIMESTAMP WITH TIME ZONE,
  date_closed TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE,
  status TEXT,
  status_detail TEXT,
  total_amount NUMERIC(14,2),
  currency_id TEXT DEFAULT 'BRL',
  shipping_cost NUMERIC(12,2),
  shipping_method TEXT,
  shipping_status TEXT,
  buyer_id TEXT,
  buyer_nickname TEXT,
  buyer_email TEXT,
  payment_method_id TEXT,
  payment_type TEXT,
  tags TEXT[],
  coupon_amount NUMERIC(12,2) DEFAULT 0,
  overpaid_amount NUMERIC(12,2) DEFAULT 0,
  installments INTEGER DEFAULT 1,
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add payment columns if they don't exist
ALTER TABLE public.ml_orders ADD COLUMN IF NOT EXISTS coupon_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.ml_orders ADD COLUMN IF NOT EXISTS overpaid_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.ml_orders ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;
ALTER TABLE public.ml_orders ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.ml_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ml_orders"
ON public.ml_orders FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage ml_orders"
ON public.ml_orders FOR ALL TO authenticated
USING (true)
WITH CHECK (true);