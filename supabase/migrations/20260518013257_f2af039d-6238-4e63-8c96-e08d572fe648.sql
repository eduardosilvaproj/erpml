-- 1. FIX GTINs ISOLATION
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Company isolation" ON public.product_gtins;
DROP POLICY IF EXISTS "Users can view product_gtins of their company" ON public.product_gtins;
DROP POLICY IF EXISTS "Users can insert product_gtins of their company" ON public.product_gtins;
DROP POLICY IF EXISTS "Users can update product_gtins of their company" ON public.product_gtins;
DROP POLICY IF EXISTS "Users can delete product_gtins of their company" ON public.product_gtins;
DROP POLICY IF EXISTS "company_isolation_select" ON public.product_gtins;
DROP POLICY IF EXISTS "company_isolation_insert" ON public.product_gtins;
DROP POLICY IF EXISTS "company_isolation_update" ON public.product_gtins;
DROP POLICY IF EXISTS "company_isolation_delete" ON public.product_gtins;

DROP POLICY IF EXISTS "Company isolation" ON public.product_alternative_gtins;
DROP POLICY IF EXISTS "Company members can view alternative GTINs" ON public.product_alternative_gtins;
DROP POLICY IF EXISTS "Company members can create alternative GTINs" ON public.product_alternative_gtins;
DROP POLICY IF EXISTS "Company members can update alternative GTINs" ON public.product_alternative_gtins;
DROP POLICY IF EXISTS "Company members can delete alternative GTINs" ON public.product_alternative_gtins;
DROP POLICY IF EXISTS "company_isolation_select" ON public.product_alternative_gtins;
DROP POLICY IF EXISTS "company_isolation_insert" ON public.product_alternative_gtins;
DROP POLICY IF EXISTS "company_isolation_update" ON public.product_alternative_gtins;
DROP POLICY IF EXISTS "company_isolation_delete" ON public.product_alternative_gtins;

-- Create standardized multi-tenant policies for GTINs
CREATE POLICY "tenant_select" ON public.product_gtins FOR SELECT USING (company_id = get_auth_company_id());
CREATE POLICY "tenant_insert" ON public.product_gtins FOR INSERT WITH CHECK (company_id = get_auth_company_id());
CREATE POLICY "tenant_update" ON public.product_gtins FOR UPDATE USING (company_id = get_auth_company_id());
CREATE POLICY "tenant_delete" ON public.product_gtins FOR DELETE USING (company_id = get_auth_company_id());

CREATE POLICY "tenant_select" ON public.product_alternative_gtins FOR SELECT USING (company_id = get_auth_company_id());
CREATE POLICY "tenant_insert" ON public.product_alternative_gtins FOR INSERT WITH CHECK (company_id = get_auth_company_id());
CREATE POLICY "tenant_update" ON public.product_alternative_gtins FOR UPDATE USING (company_id = get_auth_company_id());
CREATE POLICY "tenant_delete" ON public.product_alternative_gtins FOR DELETE USING (company_id = get_auth_company_id());


-- 2. FIX PRODUCT IMAGES SECURITY
-- Drop broad authenticated policies
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

-- Note: SELECT policy for 'product-images' might be useful to keep public if the images are shown on a storefront,
-- but the prompt asks to "permit only consistent access with the owner company".
-- I will restrict all operations to the company folder path.
CREATE POLICY "tenant_select_product_images" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'product-images' AND 
  (storage.foldername(name))[1] = (get_auth_company_id())::text
);

CREATE POLICY "tenant_insert_product_images" ON storage.objects 
FOR INSERT WITH CHECK (
  bucket_id = 'product-images' AND 
  (storage.foldername(name))[1] = (get_auth_company_id())::text
);

CREATE POLICY "tenant_update_product_images" ON storage.objects 
FOR UPDATE USING (
  bucket_id = 'product-images' AND 
  (storage.foldername(name))[1] = (get_auth_company_id())::text
);

CREATE POLICY "tenant_delete_product_images" ON storage.objects 
FOR DELETE USING (
  bucket_id = 'product-images' AND 
  (storage.foldername(name))[1] = (get_auth_company_id())::text
);


-- 3. FIX ORDER RECORDINGS PRIVACY
-- Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'order_recordings';

-- Drop broad authenticated policies
DROP POLICY IF EXISTS "Allow authenticated users to view recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload recordings" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete recordings" ON storage.objects;

-- Apply company isolation via folder name (assuming uploads follow /{company_id}/filename.mp4 pattern)
CREATE POLICY "tenant_select_order_recordings" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'order_recordings' AND 
  (storage.foldername(name))[1] = (get_auth_company_id())::text
);

CREATE POLICY "tenant_insert_order_recordings" ON storage.objects 
FOR INSERT WITH CHECK (
  bucket_id = 'order_recordings' AND 
  (storage.foldername(name))[1] = (get_auth_company_id())::text
);

CREATE POLICY "tenant_delete_order_recordings" ON storage.objects 
FOR DELETE USING (
  bucket_id = 'order_recordings' AND 
  (storage.foldername(name))[1] = (get_auth_company_id())::text
);


-- 4. REALTIME SECURITY
-- Publications are already somewhat restricted. 
-- For conferences/conference_items, ensure they have RLS.
ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_items ENABLE ROW LEVEL SECURITY;

-- If they don't have policies, add them (using company_id if exists)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conferences' AND column_name = 'company_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conferences' AND policyname = 'tenant_select') THEN
      CREATE POLICY "tenant_select" ON public.conferences FOR SELECT USING (company_id = get_auth_company_id());
    END IF;
  END IF;
END $$;

DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conference_items' AND column_name = 'company_id') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conference_items' AND policyname = 'tenant_select') THEN
      CREATE POLICY "tenant_select" ON public.conference_items FOR SELECT USING (company_id = get_auth_company_id());
    END IF;
  END IF;
END $$;
