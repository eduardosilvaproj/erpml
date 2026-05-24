
-- Add new statuses to ordem_full_status enum
ALTER TYPE public.ordem_full_status ADD VALUE IF NOT EXISTS 'separada';
ALTER TYPE public.ordem_full_status ADD VALUE IF NOT EXISTS 'enviada';

-- Create envio_pendente table to hold separated items waiting to be sent to FULL
CREATE TABLE IF NOT EXISTS public.envio_pendente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  ordem_id uuid NOT NULL REFERENCES public.ordens_full(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_envio_pendente_company ON public.envio_pendente(company_id);
CREATE INDEX IF NOT EXISTS idx_envio_pendente_ordem ON public.envio_pendente(ordem_id);

ALTER TABLE public.envio_pendente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view company envio_pendente"
  ON public.envio_pendente FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members insert company envio_pendente"
  ON public.envio_pendente FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members update company envio_pendente"
  ON public.envio_pendente FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members delete company envio_pendente"
  ON public.envio_pendente FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_envio_pendente_updated
  BEFORE UPDATE ON public.envio_pendente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- New function: marca ordem como separada e popula envio_pendente
CREATE OR REPLACE FUNCTION public.marcar_ordem_separada(_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  SELECT company_id INTO _company_id FROM public.ordens_full WHERE id = _ordem_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Ordem não encontrada';
  END IF;

  IF NOT (is_company_owner_or_manager(_user_id, _company_id)
    OR EXISTS (SELECT 1 FROM public.ordens_full WHERE id = _ordem_id AND atribuido_para = _user_id)
    OR has_role(_user_id, 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Limpa qualquer envio_pendente anterior desta ordem
  DELETE FROM public.envio_pendente WHERE ordem_id = _ordem_id;

  -- Insere itens separados (qtd > 0)
  INSERT INTO public.envio_pendente (company_id, ordem_id, product_id, quantidade)
  SELECT _company_id, _ordem_id, product_id, qtd_separada
  FROM public.ordens_full_itens
  WHERE ordem_id = _ordem_id AND qtd_separada > 0;

  UPDATE public.ordens_full
  SET status = 'separada'
  WHERE id = _ordem_id;
END;
$$;

-- Marca ordem como enviada (após gerar ordem de envio FULL)
CREATE OR REPLACE FUNCTION public.marcar_ordem_enviada(_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  SELECT company_id INTO _company_id FROM public.ordens_full WHERE id = _ordem_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Ordem não encontrada';
  END IF;

  IF NOT (is_company_owner_or_manager(_user_id, _company_id)
    OR EXISTS (SELECT 1 FROM public.ordens_full WHERE id = _ordem_id AND atribuido_para = _user_id)
    OR has_role(_user_id, 'admin')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  DELETE FROM public.envio_pendente WHERE ordem_id = _ordem_id;

  UPDATE public.ordens_full
  SET status = 'enviada', concluida_em = COALESCE(concluida_em, now())
  WHERE id = _ordem_id;
END;
$$;
