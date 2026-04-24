-- Add supplier_cnpj column to product_supplier_skus
ALTER TABLE public.product_supplier_skus ADD COLUMN IF NOT EXISTS supplier_cnpj TEXT;

-- Deduplicate before adding unique constraint
DELETE FROM public.product_supplier_skus a
USING public.product_supplier_skus b
WHERE a.id > b.id
  AND a.product_id = b.product_id
  AND a.supplier_sku = b.supplier_sku;

-- Add unique constraint
ALTER TABLE public.product_supplier_skus DROP CONSTRAINT IF EXISTS product_supplier_skus_product_id_supplier_sku_key;
ALTER TABLE public.product_supplier_skus ADD CONSTRAINT product_supplier_skus_product_id_supplier_sku_key UNIQUE (product_id, supplier_sku);