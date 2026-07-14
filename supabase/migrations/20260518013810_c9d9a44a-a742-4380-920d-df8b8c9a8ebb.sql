-- 1. Alter bucket from public to private
UPDATE storage.buckets SET public = false WHERE id = 'product-images';

-- 2. Ensure RLS policies are clean and robust (already created in previous step, but re-asserting for clarity)
-- Policies for 'product-images' folder isolation were already added:
-- tenant_select_product_images
-- tenant_insert_product_images
-- tenant_update_product_images
-- tenant_delete_product_images
