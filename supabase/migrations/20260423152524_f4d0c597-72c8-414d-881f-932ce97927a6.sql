-- Add tracking columns
ALTER TABLE public.ordens_full ADD COLUMN IF NOT EXISTS total_itens_separados integer DEFAULT 0;
ALTER TABLE public.ordens_full ADD COLUMN IF NOT EXISTS total_produtos_separados integer DEFAULT 0;

-- Function to update ordens_full progress
CREATE OR REPLACE FUNCTION public.update_ordem_full_progress()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.ordens_full
    SET 
        total_itens_separados = (
            SELECT COALESCE(SUM(qtd_separada), 0)
            FROM public.ordens_full_itens
            WHERE ordem_id = NEW.ordem_id
        ),
        total_produtos_separados = (
            SELECT COUNT(*)
            FROM public.ordens_full_itens
            WHERE ordem_id = NEW.ordem_id AND status = 'completo'
        )
    WHERE id = NEW.ordem_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on items table
DROP TRIGGER IF EXISTS tr_update_ordem_full_progress ON public.ordens_full_itens;
CREATE TRIGGER tr_update_ordem_full_progress
AFTER INSERT OR UPDATE OR DELETE ON public.ordens_full_itens
FOR EACH ROW
EXECUTE FUNCTION public.update_ordem_full_progress();

-- Initial sync
UPDATE public.ordens_full o
SET 
    total_itens_separados = (
        SELECT COALESCE(SUM(qtd_separada), 0)
        FROM public.ordens_full_itens
        WHERE ordem_id = o.id
    ),
    total_produtos_separados = (
        SELECT COUNT(*)
        FROM public.ordens_full_itens
        WHERE ordem_id = o.id AND status = 'completo'
    );
