-- 1. Criar tabela de contadores por empresa para garantir atomicidade
CREATE TABLE IF NOT EXISTS public.full_order_counters (
    company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
    last_value INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na tabela de contadores (apenas service_role ou via triggers)
ALTER TABLE public.full_order_counters ENABLE ROW LEVEL SECURITY;

-- 2. Adicionar coluna numérica se não existir e preparar para unicidade
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'full_orders' AND column_name = 'numero_sequencial') THEN
        ALTER TABLE public.full_orders ADD COLUMN numero_sequencial INTEGER;
    END IF;
END $$;

-- 3. Função para obter o próximo número de forma atômica
CREATE OR REPLACE FUNCTION public.fn_get_next_full_order_number()
RETURNS TRIGGER AS $$
DECLARE
    v_next_val INTEGER;
BEGIN
    -- Bloqueia a linha do contador da empresa específica para evitar race conditions
    -- Se não existir, cria o registro inicial
    INSERT INTO public.full_order_counters (company_id, last_value)
    VALUES (NEW.company_id, 0)
    ON CONFLICT (company_id) DO NOTHING;

    -- Update atômico com locking da linha
    UPDATE public.full_order_counters
    SET last_value = last_value + 1,
        updated_at = now()
    WHERE company_id = NEW.company_id
    RETURNING last_value INTO v_next_val;

    -- Atribui ao novo registro
    NEW.numero_sequencial := v_next_val;
    
    -- Mantém compatibilidade com o campo 'numero' anterior se necessário, 
    -- mas a verdade agora reside no numero_sequencial
    NEW.numero := v_next_val::TEXT;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar a trigger real
DROP TRIGGER IF EXISTS tr_generate_full_order_number ON public.full_orders;
CREATE TRIGGER tr_generate_full_order_number
BEFORE INSERT ON public.full_orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_get_next_full_order_number();

-- 5. Garantir unicidade via índice único composto
-- Remove índices antigos de 'numero' se forem problemáticos, mas foca no novo
CREATE UNIQUE INDEX IF NOT EXISTS idx_full_orders_unique_seq_per_company 
ON public.full_orders (company_id, numero_sequencial);
