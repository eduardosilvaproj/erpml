-- Migration completa: Adiciona colunas financeiras em ml_orders + ml_original_price + ml_price_history
-- Versão idempotente (pode rodar várias vezes sem erro)

-- ============================================
-- 1. Adiciona colunas financeiras em ml_orders
-- ============================================
ALTER TABLE public.ml_orders
ADD COLUMN IF NOT EXISTS coupon_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS overpaid_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_ml_orders_status ON public.ml_orders(status);
CREATE INDEX IF NOT EXISTS idx_ml_orders_date_created ON public.ml_orders(date_created DESC);

-- ============================================
-- 2. Adiciona coluna ml_original_price em ml_linked_products
-- ============================================
ALTER TABLE public.ml_linked_products
ADD COLUMN IF NOT EXISTS ml_original_price NUMERIC(12,2);

-- ============================================
-- 3. Tabela ml_price_history
-- ============================================
CREATE TABLE IF NOT EXISTS public.ml_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_linked_product_id uuid NOT NULL REFERENCES public.ml_linked_products(id) ON DELETE CASCADE,
  old_price NUMERIC(12,2),
  new_price NUMERIC(12,2),
  old_original_price NUMERIC(12,2),
  new_original_price NUMERIC(12,2),
  changed_by TEXT NOT NULL DEFAULT 'webhook',
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ml_price_history ENABLE ROW LEVEL SECURITY;

-- Policies (idempotentes - usa DROP IF EXISTS + CREATE)
DROP POLICY IF EXISTS "Users can view own price history" ON public.ml_price_history;
CREATE POLICY "Users can view own price history" ON public.ml_price_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ml_linked_products mlp
    JOIN public.ml_connections mc ON mc.id = mlp.connection_id
    WHERE mlp.id = ml_price_history.ml_linked_product_id
      AND ((mc.company_id = public.get_user_company_id(auth.uid())) OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Users can insert own price history" ON public.ml_price_history;
CREATE POLICY "Users can insert own price history" ON public.ml_price_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ml_linked_products mlp
    JOIN public.ml_connections mc ON mc.id = mlp.connection_id
    WHERE mlp.id = ml_price_history.ml_linked_product_id
      AND ((mc.company_id = public.get_user_company_id(auth.uid())) OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_ml_price_history_linked ON public.ml_price_history(ml_linked_product_id);
CREATE INDEX IF NOT EXISTS idx_ml_price_history_changed_at ON public.ml_price_history(changed_at DESC);