DROP POLICY IF EXISTS "return_evidence_read" ON storage.objects;
DROP POLICY IF EXISTS "return_evidence_write" ON storage.objects;
DROP POLICY IF EXISTS "return_evidence_update" ON storage.objects;
DROP POLICY IF EXISTS "return_evidence_delete" ON storage.objects;

CREATE POLICY "returns_bucket_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('return-evidence','return-photos')
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
);
CREATE POLICY "returns_bucket_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('return-evidence','return-photos')
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
);
CREATE POLICY "returns_bucket_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('return-evidence','return-photos')
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
)
WITH CHECK (
  bucket_id IN ('return-evidence','return-photos')
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
);
CREATE POLICY "returns_bucket_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('return-evidence','return-photos')
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
);