-- Add ml_original_price column to ml_linked_products for promotional price tracking
ALTER TABLE public.ml_linked_products
ADD COLUMN ml_original_price NUMERIC(12,2);
