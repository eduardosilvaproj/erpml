-- Add ean_pending column to products table
ALTER TABLE public.products 
ADD COLUMN ean_pending BOOLEAN DEFAULT false;

-- Add index for better performance when filtering products without EAN
CREATE INDEX idx_products_ean_pending ON public.products(ean_pending) WHERE ean_pending = true;
