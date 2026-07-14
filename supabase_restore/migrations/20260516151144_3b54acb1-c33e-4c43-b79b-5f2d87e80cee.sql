-- Primeiro, garante que o campo numero existe e pode ser preenchido automaticamente
ALTER TABLE public.full_orders ALTER COLUMN numero DROP DEFAULT;

-- Cria uma função para gerar o próximo número sequencial por empresa
CREATE OR REPLACE FUNCTION public.generate_full_order_number()
RETURNS TRIGGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    -- Busca o maior número numérico para a empresa atual
    -- Usamos COALESCE para tratar o primeiro registro como 0
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(numero, '\D', '', 'g'), '') AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.full_orders
    WHERE company_id = NEW.company_id;

    -- Define o novo número formatado (ex: 1, 2, 3...)
    -- Se o número já estiver definido, mantemos o que veio (permitindo overrides se necessário)
    IF NEW.numero IS NULL OR NEW.numero = '' THEN
        NEW.numero := next_num::TEXT;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria a trigger para execução antes do insert
DROP TRIGGER IF EXISTS tr_generate_full_order_number ON public.full_orders;
CREATE TRIGGER tr_generate_full_order_number
BEFORE INSERT ON public.full_orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_full_order_number();
