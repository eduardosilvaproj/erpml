-- Make envio_id nullable to support recordings without a linked order
ALTER TABLE public.gravacoes_full ALTER COLUMN envio_id DROP NOT NULL;

-- Allow company members to delete their own company recordings (currently only admin)
DROP POLICY IF EXISTS "Only admins can delete recordings" ON public.gravacoes_full;

CREATE POLICY "Members can delete own company recordings"
ON public.gravacoes_full
FOR DELETE
TO authenticated
USING ((company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for gravacoes-full bucket (private)
DROP POLICY IF EXISTS "Members can upload full recordings" ON storage.objects;
DROP POLICY IF EXISTS "Members can read full recordings" ON storage.objects;
DROP POLICY IF EXISTS "Members can delete full recordings" ON storage.objects;

CREATE POLICY "Members can upload full recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gravacoes-full'
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

CREATE POLICY "Members can read full recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'gravacoes-full'
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);

CREATE POLICY "Members can delete full recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'gravacoes-full'
  AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
);