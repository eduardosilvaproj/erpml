CREATE TABLE public.ml_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ml_linked_product_id UUID NOT NULL REFERENCES public.ml_linked_products(id) ON DELETE CASCADE,
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
