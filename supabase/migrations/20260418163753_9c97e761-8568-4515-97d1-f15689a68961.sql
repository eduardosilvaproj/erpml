-- Make invoice_id optional for inventory-type conferences
ALTER TABLE public.conferences ALTER COLUMN invoice_id DROP NOT NULL;

-- Add new columns to conferences
ALTER TABLE public.conferences
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'nota_fiscal' CHECK (tipo IN ('inventario','nota_fiscal')),
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS criado_por uuid,
  ADD COLUMN IF NOT EXISTS atualizado_por uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Allow more statuses
ALTER TABLE public.conferences DROP CONSTRAINT IF EXISTS conferences_status_check;
ALTER TABLE public.conferences
  ADD CONSTRAINT conferences_status_check
  CHECK (status IN ('em_andamento','pausada','conferida','divergente','concluida','cancelada'));

-- Add columns to conference_items
ALTER TABLE public.conference_items
  ADD COLUMN IF NOT EXISTS nome_produto text,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS ean text,
  ADD COLUMN IF NOT EXISTS tipo_contagem text NOT NULL DEFAULT 'unidade' CHECK (tipo_contagem IN ('unidade','caixa')),
  ADD COLUMN IF NOT EXISTS detalhes_caixa jsonb,
  ADD COLUMN IF NOT EXISTS atualizado_por uuid;

-- Allow inventory items without invoice_item_id
ALTER TABLE public.conference_items ALTER COLUMN invoice_item_id DROP NOT NULL;

-- Trigger to maintain updated_at
DROP TRIGGER IF EXISTS trg_conferences_updated_at ON public.conferences;
CREATE TRIGGER trg_conferences_updated_at
BEFORE UPDATE ON public.conferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_conference_items_updated_at ON public.conference_items;
CREATE TRIGGER trg_conference_items_updated_at
BEFORE UPDATE ON public.conference_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow company members to delete their own in-progress conferences (besides admins)
DROP POLICY IF EXISTS "Members can delete own in-progress conferences" ON public.conferences;
CREATE POLICY "Members can delete own in-progress conferences"
ON public.conferences FOR DELETE TO authenticated
USING (
  ((company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role))
  AND status IN ('em_andamento','pausada')
);

-- Enable Realtime
ALTER TABLE public.conferences REPLICA IDENTITY FULL;
ALTER TABLE public.conference_items REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conferences'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conferences;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conference_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conference_items;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conferences_company_status ON public.conferences(company_id, status);
CREATE INDEX IF NOT EXISTS idx_conference_items_conference ON public.conference_items(conference_id);