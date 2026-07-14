-- Enum de status
CREATE TYPE public.ordem_full_status AS ENUM ('rascunho','aguardando','em_separacao','concluida','cancelada');
CREATE TYPE public.ordem_item_status AS ENUM ('pendente','parcial','completo','excesso');

-- Função sequencial p/ numeração
CREATE SEQUENCE IF NOT EXISTS public.ordens_full_numero_seq START 1000;

-- Tabela ordens_full
CREATE TABLE public.ordens_full (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE DEFAULT ('OF-' || lpad(nextval('public.ordens_full_numero_seq')::text, 6, '0')),
  descricao text,
  status public.ordem_full_status NOT NULL DEFAULT 'rascunho',
  prazo date,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  criado_por uuid NOT NULL,
  atribuido_para uuid,
  gravacao_id uuid,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  total_itens integer NOT NULL DEFAULT 0,
  total_produtos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ordens_full_company ON public.ordens_full(company_id);
CREATE INDEX idx_ordens_full_atribuido ON public.ordens_full(atribuido_para);
CREATE INDEX idx_ordens_full_status ON public.ordens_full(status);

-- Tabela itens
CREATE TABLE public.ordens_full_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id uuid NOT NULL REFERENCES public.ordens_full(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qtd_solicitada integer NOT NULL DEFAULT 1,
  qtd_separada integer NOT NULL DEFAULT 0,
  status public.ordem_item_status NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ordens_full_itens_ordem ON public.ordens_full_itens(ordem_id);
CREATE INDEX idx_ordens_full_itens_product ON public.ordens_full_itens(product_id);

-- Triggers updated_at
CREATE TRIGGER trg_ordens_full_updated BEFORE UPDATE ON public.ordens_full
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ordens_full_itens_updated BEFORE UPDATE ON public.ordens_full_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.ordens_full ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_full_itens ENABLE ROW LEVEL SECURITY;

-- Função helper: usuário é owner/manager da empresa?
CREATE OR REPLACE FUNCTION public.is_company_owner_or_manager(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE user_id = _user_id AND company_id = _company_id
      AND is_active = true AND role IN ('owner','manager')
  )
$$;

-- Policies ordens_full
CREATE POLICY "Members can view company orders" ON public.ordens_full
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE POLICY "Owner/manager can insert orders" ON public.ordens_full
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND criado_por = auth.uid()
    AND (is_company_owner_or_manager(auth.uid(), company_id) OR has_role(auth.uid(),'admin'))
  );

CREATE POLICY "Owner/manager or assignee can update orders" ON public.ordens_full
  FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (
      is_company_owner_or_manager(auth.uid(), company_id)
      OR atribuido_para = auth.uid()
      OR has_role(auth.uid(),'admin')
    )
  );

CREATE POLICY "Owner/manager can delete orders" ON public.ordens_full
  FOR DELETE TO authenticated
  USING (is_company_owner_or_manager(auth.uid(), company_id) OR has_role(auth.uid(),'admin'));

-- Policies itens
CREATE POLICY "Members can view order items" ON public.ordens_full_itens
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ordens_full o WHERE o.id = ordem_id
    AND (o.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(),'admin'))));

CREATE POLICY "Owner/manager can insert order items" ON public.ordens_full_itens
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ordens_full o WHERE o.id = ordem_id
    AND (is_company_owner_or_manager(auth.uid(), o.company_id) OR has_role(auth.uid(),'admin'))));

CREATE POLICY "Owner/manager or assignee can update order items" ON public.ordens_full_itens
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ordens_full o WHERE o.id = ordem_id
    AND (is_company_owner_or_manager(auth.uid(), o.company_id)
      OR o.atribuido_para = auth.uid()
      OR has_role(auth.uid(),'admin'))));

CREATE POLICY "Owner/manager can delete order items" ON public.ordens_full_itens
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ordens_full o WHERE o.id = ordem_id
    AND (is_company_owner_or_manager(auth.uid(), o.company_id) OR has_role(auth.uid(),'admin'))));

-- Função para concluir ordem: transfere stock_physical -> stock_full
CREATE OR REPLACE FUNCTION public.concluir_ordem_full(_ordem_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _company_id uuid;
  _user_id uuid := auth.uid();
  _item RECORD;
BEGIN
  SELECT company_id INTO _company_id FROM public.ordens_full WHERE id = _ordem_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Ordem não encontrada';
  END IF;

  -- Verifica permissão
  IF NOT (is_company_owner_or_manager(_user_id, _company_id)
    OR EXISTS (SELECT 1 FROM public.ordens_full WHERE id = _ordem_id AND atribuido_para = _user_id)
    OR has_role(_user_id, 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão para concluir esta ordem';
  END IF;

  -- Transfere estoque para cada item
  FOR _item IN
    SELECT product_id, qtd_separada FROM public.ordens_full_itens
    WHERE ordem_id = _ordem_id AND qtd_separada > 0
  LOOP
    UPDATE public.products
    SET stock_physical = GREATEST(0, stock_physical - _item.qtd_separada),
        stock_full = stock_full + _item.qtd_separada
    WHERE id = _item.product_id;
  END LOOP;

  -- Atualiza status
  UPDATE public.ordens_full
  SET status = 'concluida', concluida_em = now()
  WHERE id = _ordem_id;
END;
$$;