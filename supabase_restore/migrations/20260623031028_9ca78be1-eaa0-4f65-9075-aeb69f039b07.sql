ALTER TABLE public.full_order_items
ADD COLUMN IF NOT EXISTS kit_id UUID REFERENCES public.product_kits(id) ON DELETE CASCADE;

ALTER TABLE public.full_order_items
ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.full_order_items
DROP CONSTRAINT IF EXISTS full_order_items_product_or_kit;

ALTER TABLE public.full_order_items
ADD CONSTRAINT full_order_items_product_or_kit
CHECK (
  (product_id IS NOT NULL AND kit_id IS NULL)
  OR
  (product_id IS NULL AND kit_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_full_order_items_kit_id
ON public.full_order_items(kit_id);