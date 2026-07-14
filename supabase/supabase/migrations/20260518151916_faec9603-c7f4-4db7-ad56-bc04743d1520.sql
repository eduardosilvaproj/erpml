-- Drop existing global unique constraints/indexes
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;
DROP INDEX IF EXISTS public.idx_products_ean;

-- Create company-scoped unique constraints
-- First for SKU
ALTER TABLE public.products ADD CONSTRAINT products_company_sku_key UNIQUE (company_id, sku);

-- Then for EAN (only where not null)
CREATE UNIQUE INDEX idx_products_company_ean ON public.products (company_id, ean) WHERE (ean IS NOT NULL);
