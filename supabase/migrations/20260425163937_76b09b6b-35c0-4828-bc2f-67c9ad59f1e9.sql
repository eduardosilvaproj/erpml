-- Adicionar colunas necessárias na full_orders se não existirem
ALTER TABLE public.full_orders ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.full_orders ADD COLUMN IF NOT EXISTS descricao TEXT;

-- Remover tabelas legadas
DROP TABLE IF EXISTS public.envio_pendente CASCADE;
DROP TABLE IF EXISTS public.ordens_full_itens CASCADE;
DROP TABLE IF EXISTS public.ordens_full CASCADE;

-- Garantir que full_orders tenha RLS habilitado (já deve ter, mas por precaução)
ALTER TABLE public.full_orders ENABLE ROW LEVEL SECURITY;

-- Se não houver políticas, criar as básicas para company_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'full_orders' AND policyname = 'Users can view their own company full orders'
    ) THEN
        CREATE POLICY "Users can view their own company full orders" 
        ON public.full_orders FOR SELECT 
        USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'full_orders' AND policyname = 'Users can insert their own company full orders'
    ) THEN
        CREATE POLICY "Users can insert their own company full orders" 
        ON public.full_orders FOR INSERT 
        WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'full_orders' AND policyname = 'Users can update their own company full orders'
    ) THEN
        CREATE POLICY "Users can update their own company full orders" 
        ON public.full_orders FOR UPDATE 
        USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'full_orders' AND policyname = 'Users can delete their own company full orders'
    ) THEN
        CREATE POLICY "Users can delete their own company full orders" 
        ON public.full_orders FOR DELETE 
        USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
    END IF;
END
$$;
