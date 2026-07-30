-- Migration: Adiciona ml_original_price + tabela ml_price_history
-- Versão idempotente (pode rodar várias vezes sem erro)

-- 1. Adiciona coluna ml_original_price em ml_linked_products
ALTER TABLE public.ml_linked_products
ADD COLUMN IF NOT EXISTS ml_original_price NUMERIC(12,2);

-- 2. Tabela ml_price_history
CREATE TABLE IF NOT EXISTS public.ml_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ml_linked_product_id UUID NOT NULL REFERENCES public.ml_linked_products(id) ON DELETE CASCADE,
  old_price NUMERIC(12,2),
  new_price NUMERIC(12,2),
  old_original_price NUMERIC(12,2),
  new_original_price NUMERIC(12,2),
  changed_by TEXT NOT NULL DEFAULT 'webhook',
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. RLS + Policies (idempotente)
ALTER TABLE public.ml_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own price history" ON public.ml_price_history;
CREATE POLICY "Users can view own price history" ON public.ml_price_history
  FOR SELECT TO authenticated USING (
    ml_linked_product_id IN (SELECT id FROM public.ml_linked_products WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Service role can insert price history" ON public.ml_price_history;
CREATE POLICY "Service role can insert price history" ON public.ml_price_history
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage price history" ON public.ml_price_history;
CREATE POLICY "Service role can manage price history" ON public.ml_price_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Index para performance
CREATE INDEX IF NOT EXISTS idx_ml_price_history_linked_product
  ON public.ml_price_history(ml_linked_product_id);

CREATE INDEX IF NOT EXISTS idx_ml_price_history_changed_at
  ON public.ml_price_history(changed_at DESC);