-- Add unique internal ID
ALTER TABLE public.full_orders 
ADD COLUMN IF NOT EXISTS ordem_id text UNIQUE;

-- Ensure frete_ml exists (already exists but adding just in case for completeness of the migration)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'full_orders' AND column_name = 'frete_ml') THEN
        ALTER TABLE public.full_orders ADD COLUMN frete_ml text;
    END IF;
END $$;

-- Remove possible unique constraints if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ordens_full_numero_key') THEN
        ALTER TABLE public.full_orders DROP CONSTRAINT ordens_full_numero_key;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'full_orders_frete_ml_key') THEN
        ALTER TABLE public.full_orders DROP CONSTRAINT full_orders_frete_ml_key;
    END IF;
END $$;