
-- 1. Tabela de gravações
CREATE TABLE public.gravacoes_full (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  envio_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('separacao', 'despacho')),
  url_video TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  duracao_segundos INTEGER NOT NULL DEFAULT 0,
  tamanho_bytes BIGINT NOT NULL DEFAULT 0,
  usuario_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gravacoes_full_envio ON public.gravacoes_full(envio_id);
CREATE INDEX idx_gravacoes_full_company ON public.gravacoes_full(company_id);

ALTER TABLE public.gravacoes_full ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read own company recordings"
ON public.gravacoes_full FOR SELECT TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can insert own company recordings"
ON public.gravacoes_full FOR INSERT TO authenticated
WITH CHECK (
  (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  AND usuario_id = auth.uid()
);

CREATE POLICY "Members can update own company recordings"
ON public.gravacoes_full FOR UPDATE TO authenticated
USING (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete recordings"
ON public.gravacoes_full FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Bucket privado para vídeos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gravacoes-full',
  'gravacoes-full',
  false,
  524288000, -- 500MB
  ARRAY['video/webm', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Políticas de storage (caminho: {company_id}/{tipo}/{arquivo}.webm)
CREATE POLICY "Company members can read own recordings"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'gravacoes-full'
  AND (
    public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Company members can upload recordings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'gravacoes-full'
  AND (
    public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Company members can update recordings"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'gravacoes-full'
  AND (
    public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Admins can delete recordings"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'gravacoes-full'
  AND public.has_role(auth.uid(), 'admin')
);
