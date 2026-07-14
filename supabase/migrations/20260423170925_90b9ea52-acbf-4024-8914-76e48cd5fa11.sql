-- Add new columns to full_orders
ALTER TABLE public.full_orders ADD COLUMN IF NOT EXISTS separado_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.full_orders ADD COLUMN IF NOT EXISTS separado_por UUID REFERENCES auth.users(id);
ALTER TABLE public.full_orders ADD COLUMN IF NOT EXISTS previsao_carregamento TIMESTAMP WITH TIME ZONE;

-- Add new columns to ordens_full to keep in sync if needed
ALTER TABLE public.ordens_full ADD COLUMN IF NOT EXISTS separado_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.ordens_full ADD COLUMN IF NOT EXISTS separado_por UUID REFERENCES auth.users(id);
ALTER TABLE public.ordens_full ADD COLUMN IF NOT EXISTS previsao_carregamento TIMESTAMP WITH TIME ZONE;

-- Update status comment for full_orders
COMMENT ON COLUMN public.full_orders.status IS 'status: pdf_carregado | separando | aguardando_carregamento | carregando | enviado';
