ALTER TABLE public.product_kits ADD COLUMN ean TEXT;
CREATE INDEX idx_product_kits_ean ON public.product_kits(ean);
