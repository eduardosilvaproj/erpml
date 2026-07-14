-- Add ean column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ean text;

-- Populate ean with barcode values where ean is null
UPDATE public.products SET ean = barcode WHERE ean IS NULL AND barcode IS NOT NULL;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_ean ON public.products(ean) WHERE ean IS NOT NULL;
