ALTER TABLE public.ordens_full ADD COLUMN IF NOT EXISTS frete_ml text;
ALTER TABLE public.full_orders ADD COLUMN IF NOT EXISTS frete_ml text;