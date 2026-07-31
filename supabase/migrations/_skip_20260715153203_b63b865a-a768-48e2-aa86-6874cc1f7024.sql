-- Enums
CREATE TYPE public.return_status AS ENUM ('pendente','em_conferencia','aguardando_decisao','concluida','cancelada');
CREATE TYPE public.return_source AS ENUM ('mercado_livre','loja','manual','pdv');
CREATE TYPE public.item_condition AS ENUM ('aprovado','avariado','errado','incompleto','embalagem_violada','outro');
CREATE TYPE public.quarantine_status AS ENUM ('em_quarentena','liberado','descartado');

-- ============ returns ============
CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  numero text NOT NULL,
  source public.return_source NOT NULL DEFAULT 'manual',
  external_id text,
  status public.return_status NOT NULL DEFAULT 'pendente',
  customer_name text,
  customer_document text,
  order_reference text,
  motivo text,
  valor_total numeric(12,2) DEFAULT 0,
  responsavel_id uuid REFERENCES auth.users(id),
  received_at timestamptz,
  concluded_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_returns_company ON public.returns(company_id);
CREATE INDEX idx_returns_status ON public.returns(company_id, status);
CREATE INDEX idx_returns_external ON public.returns(company_id, external_id);
CREATE UNIQUE INDEX ux_returns_company_numero ON public.returns(company_id, numero);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "returns_select" ON public.returns FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "returns_insert" ON public.returns FOR INSERT TO authenticated
WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "returns_update" ON public.returns FOR UPDATE TO authenticated
USING (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'))
WITH CHECK (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "returns_delete" ON public.returns FOR DELETE TO authenticated
USING (is_company_owner_or_manager(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_returns_updated_at BEFORE UPDATE ON public.returns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ return_items ============
CREATE TABLE public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sku text,
  ean text,
  nome_produto text,
  expected_quantity integer NOT NULL DEFAULT 1,
  received_quantity integer NOT NULL DEFAULT 0,
  condition public.item_condition,
  decision text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_return_items_return ON public.return_items(return_id);
CREATE INDEX idx_return_items_company ON public.return_items(company_id);
CREATE INDEX idx_return_items_product ON public.return_items(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_items TO authenticated;
GRANT ALL ON public.return_items TO service_role;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "return_items_select" ON public.return_items FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "return_items_insert" ON public.return_items FOR INSERT TO authenticated
WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "return_items_update" ON public.return_items FOR UPDATE TO authenticated
USING (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'))
WITH CHECK (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "return_items_delete" ON public.return_items FOR DELETE TO authenticated
USING (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_return_items_updated_at BEFORE UPDATE ON public.return_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ return_actions ============
CREATE TABLE public.return_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_return_actions_return ON public.return_actions(return_id, created_at DESC);
CREATE INDEX idx_return_actions_company ON public.return_actions(company_id);

GRANT SELECT, INSERT ON public.return_actions TO authenticated;
GRANT ALL ON public.return_actions TO service_role;
ALTER TABLE public.return_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "return_actions_select" ON public.return_actions FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "return_actions_insert" ON public.return_actions FOR INSERT TO authenticated
WITH CHECK (is_company_member(auth.uid(), company_id));

-- ============ return_evidence ============
CREATE TABLE public.return_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  return_item_id uuid REFERENCES public.return_items(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  bucket text NOT NULL DEFAULT 'return_evidence',
  kind text NOT NULL DEFAULT 'photo',
  caption text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_return_evidence_return ON public.return_evidence(return_id);
CREATE INDEX idx_return_evidence_company ON public.return_evidence(company_id);

GRANT SELECT, INSERT, DELETE ON public.return_evidence TO authenticated;
GRANT ALL ON public.return_evidence TO service_role;
ALTER TABLE public.return_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "return_evidence_select" ON public.return_evidence FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "return_evidence_insert" ON public.return_evidence FOR INSERT TO authenticated
WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "return_evidence_delete" ON public.return_evidence FOR DELETE TO authenticated
USING (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));

-- ============ quarantine_stock ============
CREATE TABLE public.quarantine_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  return_id uuid REFERENCES public.returns(id) ON DELETE SET NULL,
  return_item_id uuid REFERENCES public.return_items(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  condition public.item_condition,
  status public.quarantine_status NOT NULL DEFAULT 'em_quarentena',
  reason text,
  released_at timestamptz,
  released_by uuid REFERENCES auth.users(id),
  released_to text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quarantine_company ON public.quarantine_stock(company_id, status);
CREATE INDEX idx_quarantine_product ON public.quarantine_stock(product_id);
CREATE INDEX idx_quarantine_return ON public.quarantine_stock(return_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quarantine_stock TO authenticated;
GRANT ALL ON public.quarantine_stock TO service_role;
ALTER TABLE public.quarantine_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quarantine_select" ON public.quarantine_stock FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "quarantine_insert" ON public.quarantine_stock FOR INSERT TO authenticated
WITH CHECK (is_company_member(auth.uid(), company_id));
CREATE POLICY "quarantine_update" ON public.quarantine_stock FOR UPDATE TO authenticated
USING (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'))
WITH CHECK (is_company_member(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "quarantine_delete" ON public.quarantine_stock FOR DELETE TO authenticated
USING (is_company_owner_or_manager(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_quarantine_updated_at BEFORE UPDATE ON public.quarantine_stock
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Storage policies for return_evidence + return_photos buckets ============
-- Buckets themselves are created via supabase--storage_create_bucket.
-- These policies scope objects by company_id prefix (first folder segment).
CREATE POLICY "return_evidence_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('return_evidence','return_photos')
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
);
CREATE POLICY "return_evidence_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('return_evidence','return_photos')
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
);
CREATE POLICY "return_evidence_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('return_evidence','return_photos')
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
)
WITH CHECK (
  bucket_id IN ('return_evidence','return_photos')
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
);
CREATE POLICY "return_evidence_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('return_evidence','return_photos')
  AND (storage.foldername(name))[1] = (public.get_auth_company_id())::text
);