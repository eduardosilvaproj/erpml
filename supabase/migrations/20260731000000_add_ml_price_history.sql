-- Ensure ml_linked_products table exists before creating price history
CREATE TABLE IF NOT EXISTS public.ml_linked_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  ml_item_id TEXT NOT NULL,
  ml_title TEXT,
  ml_price NUMERIC(12,2),
  ml_original_price NUMERIC(12,2),
  ml_available_quantity INTEGER DEFAULT 0,
  ml_status TEXT DEFAULT 'unknown',
  sync_status TEXT DEFAULT 'pending',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, ml_item_id)
);

-- Create ml_price_history table
CREATE TABLE IF NOT EXISTS public.ml_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ml_linked_product_id UUID,
  old_price NUMERIC(12,2),
  new_price NUMERIC(12,2),
  old_original_price NUMERIC(12,2),
  new_original_price NUMERIC(12,2),
  changed_by TEXT NOT NULL DEFAULT 'webhook',
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ml_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own price history"
ON public.ml_price_history FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Service role can insert price history"
ON public.ml_price_history FOR INSERT TO authenticated
WITH CHECK (true);
