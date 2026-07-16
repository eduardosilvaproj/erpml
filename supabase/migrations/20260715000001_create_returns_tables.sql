-- ============================================================
-- Módulo Devoluções e Retiradas
-- Tabelas, RLS, Storage Buckets
-- ============================================================

-- 1. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE return_status AS ENUM (
    'pendente_recebimento', 'recebido', 'em_conferencia',
    'aguardando_decisao', 'aprovada', 'recusada', 'concluida', 'cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE return_source AS ENUM ('manual', 'ml_return', 'ml_claim');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE item_condition AS ENUM (
    'good', 'damaged', 'wrong_item', 'missing',
    'incomplete', 'packaging_violated', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE quarantine_status AS ENUM (
    'quarantined', 'released', 'discarded', 'transferred'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. RETURNS TABLE
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- ML Integration
  ml_return_id TEXT,
  ml_order_id TEXT,
  ml_claim_id TEXT,

  -- Status & Classification
  status return_status NOT NULL DEFAULT 'pendente_recebimento',
  source return_source NOT NULL DEFAULT 'manual',
  motivo TEXT,
  classification item_condition,
  classification_reason TEXT,
  classification_notes TEXT,

  -- Financial
  refund_amount NUMERIC(10,2),
  ml_refund_id TEXT,

  -- Tracking
  recebido_em TIMESTAMPTZ,
  conferencia_iniciada_em TIMESTAMPTZ,
  conferencia_finalizada_em TIMESTAMPTZ,
  decisions_made_by UUID REFERENCES profiles(id),

  -- Operator
  operador_id UUID REFERENCES profiles(id),
  operador_recebimento_id UUID REFERENCES profiles(id),

  -- Audit
  created_by UUID REFERENCES profiles(id),

  -- Extra
  notes TEXT,
  external_reference TEXT,
  bipagem_state JSONB DEFAULT '[]'::JSONB
);

-- 3. RETURN ITEMS
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  product_id UUID REFERENCES products(id),
  ml_item_id TEXT,
  sku TEXT,
  nome_produto TEXT,

  expected_quantity INTEGER DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  approved_quantity INTEGER DEFAULT 0,

  status TEXT DEFAULT 'pendente',
  condition item_condition,
  condition_notes TEXT,

  bipagem_state JSONB DEFAULT '[]'::JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(return_id, product_id)
);

-- 4. RETURN ACTIONS (timeline)
CREATE TABLE IF NOT EXISTS return_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  action TEXT NOT NULL,
  description TEXT,
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RETURN EVIDENCE (videos, photos, documents)
CREATE TABLE IF NOT EXISTS return_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('video', 'photo', 'document', 'note')),
  storage_path TEXT,
  public_url TEXT,

  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  duration_seconds INTEGER,

  recorded_at TIMESTAMPTZ,
  recorded_by UUID REFERENCES profiles(id),
  description TEXT,
  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. QUARANTINE STOCK
CREATE TABLE IF NOT EXISTS quarantine_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 0,

  source_type TEXT NOT NULL CHECK (source_type IN ('return', 'conference', 'manual')),
  source_id UUID,

  status quarantine_status DEFAULT 'quarantined',
  reason TEXT,
  inspection_notes TEXT,

  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INDEXES
CREATE INDEX IF NOT EXISTS idx_returns_company_id ON returns(company_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_ml_return_id ON returns(ml_return_id);
CREATE INDEX IF NOT EXISTS idx_returns_ml_order_id ON returns(ml_order_id);
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product_id ON return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_return_actions_return_id ON return_actions(return_id);
CREATE INDEX IF NOT EXISTS idx_return_evidence_return_id ON return_evidence(return_id);
CREATE INDEX IF NOT EXISTS idx_quarantine_company_id ON quarantine_stock(company_id);
CREATE INDEX IF NOT EXISTS idx_quarantine_status ON quarantine_stock(status);
CREATE INDEX IF NOT EXISTS idx_quarantine_product_id ON quarantine_stock(product_id);

-- 8. UPDATED_AT TRIGGERS
CREATE OR REPLACE FUNCTION update_returns_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON returns
    FOR EACH ROW EXECUTE FUNCTION update_returns_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_return_items_updated_at BEFORE UPDATE ON return_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_quarantine_stock_updated_at BEFORE UPDATE ON quarantine_stock
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. RLS POLICIES
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarantine_stock ENABLE ROW LEVEL SECURITY;

-- Returns: SELECT
CREATE POLICY "returns_select" ON returns FOR SELECT
  USING (company_id = get_auth_company_id());

CREATE POLICY "returns_insert" ON returns FOR INSERT
  WITH CHECK (company_id = get_auth_company_id());

CREATE POLICY "returns_update" ON returns FOR UPDATE
  USING (company_id = get_auth_company_id());

CREATE POLICY "returns_delete" ON returns FOR DELETE
  USING (company_id = get_auth_company_id());

-- Return Items
CREATE POLICY "return_items_select" ON return_items FOR SELECT
  USING (company_id = get_auth_company_id());

CREATE POLICY "return_items_insert" ON return_items FOR INSERT
  WITH CHECK (company_id = get_auth_company_id());

CREATE POLICY "return_items_update" ON return_items FOR UPDATE
  USING (company_id = get_auth_company_id());

CREATE POLICY "return_items_delete" ON return_items FOR DELETE
  USING (company_id = get_auth_company_id());

-- Return Actions
CREATE POLICY "return_actions_select" ON return_actions FOR SELECT
  USING (company_id = get_auth_company_id());

CREATE POLICY "return_actions_insert" ON return_actions FOR INSERT
  WITH CHECK (company_id = get_auth_company_id());

CREATE POLICY "return_actions_delete" ON return_actions FOR DELETE
  USING (company_id = get_auth_company_id());

-- Return Evidence
CREATE POLICY "return_evidence_select" ON return_evidence FOR SELECT
  USING (company_id = get_auth_company_id());

CREATE POLICY "return_evidence_insert" ON return_evidence FOR INSERT
  WITH CHECK (company_id = get_auth_company_id());

CREATE POLICY "return_evidence_update" ON return_evidence FOR UPDATE
  USING (company_id = get_auth_company_id());

CREATE POLICY "return_evidence_delete" ON return_evidence FOR DELETE
  USING (company_id = get_auth_company_id());

-- Quarantine Stock
CREATE POLICY "quarantine_select" ON quarantine_stock FOR SELECT
  USING (company_id = get_auth_company_id());

CREATE POLICY "quarantine_insert" ON quarantine_stock FOR INSERT
  WITH CHECK (company_id = get_auth_company_id());

CREATE POLICY "quarantine_update" ON quarantine_stock FOR UPDATE
  USING (company_id = get_auth_company_id());

CREATE POLICY "quarantine_delete" ON quarantine_stock FOR DELETE
  USING (company_id = get_auth_company_id());

-- 10. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public) VALUES ('return_evidence', 'return_evidence', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('return_photos', 'return_photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for return_evidence
CREATE POLICY "return_evidence_select_storage" ON storage.objects FOR SELECT
  USING (bucket_id IN ('return_evidence', 'return_photos') AND EXISTS (
    SELECT 1 FROM company_members cm WHERE cm.user_id = auth.uid() AND cm.is_active = true
  ));

CREATE POLICY "return_evidence_insert_storage" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('return_evidence', 'return_photos') AND EXISTS (
    SELECT 1 FROM company_members cm WHERE cm.user_id = auth.uid() AND cm.is_active = true
  ));

CREATE POLICY "return_evidence_delete_storage" ON storage.objects FOR DELETE
  USING (bucket_id IN ('return_evidence', 'return_photos') AND EXISTS (
    SELECT 1 FROM company_members cm WHERE cm.user_id = auth.uid() AND cm.is_active = true
  ));