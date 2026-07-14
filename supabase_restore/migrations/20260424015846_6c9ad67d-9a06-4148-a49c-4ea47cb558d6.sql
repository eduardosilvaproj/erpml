-- Function to validate EAN uniqueness across products and alternative GTINs
CREATE OR REPLACE FUNCTION public.validate_ean_uniqueness()
RETURNS TRIGGER AS $$
DECLARE
    ean_to_check TEXT;
    company_id_to_check UUID;
    product_id_to_check UUID;
    conflict_found BOOLEAN;
BEGIN
    -- Determine the EAN and IDs based on which table triggered this
    IF TG_TABLE_NAME = 'products' THEN
        ean_to_check := NEW.ean;
        company_id_to_check := NEW.company_id;
        product_id_to_check := NEW.id;
    ELSIF TG_TABLE_NAME = 'product_alternative_gtins' THEN
        ean_to_check := NEW.gtin;
        company_id_to_check := NEW.company_id;
        product_id_to_check := NEW.product_id;
    END IF;

    -- If EAN is null or empty, skip validation
    IF ean_to_check IS NULL OR ean_to_check = '' THEN
        RETURN NEW;
    END IF;

    -- Check if EAN exists in products table (excluding the current product)
    SELECT EXISTS (
        SELECT 1 FROM public.products 
        WHERE ean = ean_to_check 
        AND company_id = company_id_to_check 
        AND id != product_id_to_check
    ) INTO conflict_found;

    IF conflict_found THEN
        RAISE EXCEPTION 'O EAN % já está vinculado a outro produto nesta empresa.', ean_to_check;
    END IF;

    -- Check if EAN exists in product_alternative_gtins table
    IF TG_TABLE_NAME = 'products' THEN
        -- Check if any other product has this EAN as an alternative GTIN
        SELECT EXISTS (
            SELECT 1 FROM public.product_alternative_gtins 
            WHERE gtin = ean_to_check 
            AND company_id = company_id_to_check 
            AND product_id != product_id_to_check
        ) INTO conflict_found;
    ELSIF TG_TABLE_NAME = 'product_alternative_gtins' THEN
        -- Check if any other product has this EAN as an alternative GTIN
        -- OR if another entry for the SAME product already has this EAN (redundant but check anyway)
        SELECT EXISTS (
            SELECT 1 FROM public.product_alternative_gtins 
            WHERE gtin = ean_to_check 
            AND company_id = company_id_to_check 
            AND id != NEW.id
        ) INTO conflict_found;
    END IF;

    IF conflict_found THEN
        RAISE EXCEPTION 'O EAN % já está vinculado como um GTIN alternativo a outro produto nesta empresa.', ean_to_check;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for products table
DROP TRIGGER IF EXISTS trigger_validate_product_ean ON public.products;
CREATE TRIGGER trigger_validate_product_ean
BEFORE INSERT OR UPDATE OF ean ON public.products
FOR EACH ROW EXECUTE FUNCTION public.validate_ean_uniqueness();

-- Trigger for alternative GTINs table
DROP TRIGGER IF EXISTS trigger_validate_alternative_gtin ON public.product_alternative_gtins;
CREATE TRIGGER trigger_validate_alternative_gtin
BEFORE INSERT OR UPDATE OF gtin ON public.product_alternative_gtins
FOR EACH ROW EXECUTE FUNCTION public.validate_ean_uniqueness();