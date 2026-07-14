-- Adiciona colunas para salvar estado de bipagem
ALTER TABLE public.full_orders 
ADD COLUMN IF NOT EXISTS bipagem_state JSONB,
ADD COLUMN IF NOT EXISTS pausado_em TIMESTAMP WITH TIME ZONE;

-- Cria tabela para GTINs (unidade e caixa)
CREATE TABLE IF NOT EXISTS public.product_gtins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    gtin TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'unidade', -- 'unidade' ou 'caixa'
    qtd_por_caixa INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(company_id, gtin)
);

-- RLS para product_gtins
ALTER TABLE public.product_gtins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view product_gtins of their company" 
ON public.product_gtins FOR SELECT 
USING (company_id IN (SELECT id FROM public.companies));

CREATE POLICY "Users can insert product_gtins of their company" 
ON public.product_gtins FOR INSERT 
WITH CHECK (company_id IN (SELECT id FROM public.companies));

CREATE POLICY "Users can update product_gtins of their company" 
ON public.product_gtins FOR UPDATE 
USING (company_id IN (SELECT id FROM public.companies));

CREATE POLICY "Users can delete product_gtins of their company" 
ON public.product_gtins FOR DELETE 
USING (company_id IN (SELECT id FROM public.companies));
