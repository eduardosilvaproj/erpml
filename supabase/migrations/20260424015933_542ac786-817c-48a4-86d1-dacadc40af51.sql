-- Function to validate EAN uniqueness across products, alternative GTINs, and kits
CREATE OR REPLACE FUNCTION public.validate_ean_uniqueness()
RETURNS TRIGGER AS $$
DECLARE
    ean_to_check TEXT;
    company_id_to_check UUID;
    record_id_to_check UUID;
    conflict_found BOOLEAN;
BEGIN
    -- Determine the EAN and IDs based on which table triggered this
    IF TG_TABLE_NAME = 'products' THEN
        ean_to_check := NEW.ean;
        company_id_to_check := NEW.company_id;
        record_id_to_check := NEW.id;
    ELSIF TG_TABLE_NAME = 'product_alternative_gtins' THEN
        ean_to_check := NEW.gtin;
        company_id_to_check := NEW.company_id;
        record_id_to_check := NEW.product_id; -- We use product_id for crossing check
    ELSIF TG_TABLE_NAME = 'product_kits' THEN
        ean_to_check := NEW.ean;
        company_id_to_check := NEW.company_id;
        record_id_to_check := NEW.id;
    END IF;

    -- If EAN is null or empty, skip validation
    IF ean_to_check IS NULL OR ean_to_check = '' THEN
        RETURN NEW;
    END IF;

    -- 1. Check products table
    IF TG_TABLE_NAME = 'products' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.products 
            WHERE ean = ean_to_check 
            AND company_id = company_id_to_check 
            AND id != record_id_to_check
        ) INTO conflict_found;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.products 
            WHERE ean = ean_to_check 
            AND company_id = company_id_to_check 
            AND id != record_id_to_check -- record_id_to_check is product_id for alt gtins
        ) INTO conflict_found;
    END IF;

    IF conflict_found THEN
        RAISE EXCEPTION 'O EAN % já está vinculado a outro produto nesta empresa.', ean_to_check;
    END IF;

    -- 2. Check product_alternative_gtins table
    IF TG_TABLE_NAME = 'product_alternative_gtins' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.product_alternative_gtins 
            WHERE gtin = ean_to_check 
            AND company_id = company_id_to_check 
            AND id != NEW.id
        ) INTO conflict_found;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.product_alternative_gtins 
            WHERE gtin = ean_to_check 
            AND company_id = company_id_to_check 
            AND product_id != record_id_to_check
        ) INTO conflict_found;
    END IF;

    IF conflict_found THEN
        RAISE EXCEPTION 'O EAN % já está vinculado como um GTIN alternativo a outro produto nesta empresa.', ean_to_check;
    END IF;

    -- 3. Check product_kits table
    IF TG_TABLE_NAME = 'product_kits' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.product_kits 
            WHERE ean = ean_to_check 
            AND company_id = company_id_to_check 
            AND id != record_id_to_check
        ) INTO conflict_found;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.product_kits 
            WHERE ean = ean_to_check 
            AND company_id = company_id_to_check 
        ) INTO conflict_found;
    END IF;

    IF conflict_found THEN
        RAISE EXCEPTION 'O EAN % já está vinculado a um Kit nesta empresa.', ean_to_check;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for product_kits table
DROP TRIGGER IF EXISTS trigger_validate_kit_ean ON public.product_kits;
CREATE TRIGGER trigger_validate_kit_ean
BEFORE INSERT OR UPDATE OF ean ON public.product_kits
FOR EACH ROW EXECUTE FUNCTION public.validate_ean_uniqueness();