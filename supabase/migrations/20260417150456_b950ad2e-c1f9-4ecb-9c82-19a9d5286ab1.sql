-- Fix #2 & #3: Restrict listing of public buckets (avatars, product-images)
-- Remove broad SELECT policies that allow listing all files. Direct file access via public URL still works.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND (qual ILIKE '%avatars%' OR qual ILIKE '%product-images%' OR qual ILIKE '%product_images%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Fix #4: Allow users to view their own ML OAuth connection
CREATE POLICY "Users can view own ML connection"
ON public.ml_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to update their own ML connection (token refresh)
CREATE POLICY "Users can update own ML connection"
ON public.ml_connections
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);