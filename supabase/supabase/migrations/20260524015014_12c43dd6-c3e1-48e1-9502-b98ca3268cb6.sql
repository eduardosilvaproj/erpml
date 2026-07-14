
-- 1. Avatars bucket: explicit public SELECT policy
CREATE POLICY "Avatars are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- 2. order_recordings: tenant-scoped UPDATE policy
CREATE POLICY "tenant_update_order_recordings"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'order_recordings'
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
)
WITH CHECK (
  bucket_id = 'order_recordings'
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
);

-- 3. realtime.messages: enable RLS and restrict to authenticated users only
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can receive realtime broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can send realtime broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);
