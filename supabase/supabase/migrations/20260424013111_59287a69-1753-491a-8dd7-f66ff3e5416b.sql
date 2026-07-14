CREATE OR REPLACE FUNCTION public.search_products_with_suppliers(search_term text, p_company_id uuid)
RETURNS SETOF products AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.*
    FROM public.products p
    LEFT JOIN public.product_supplier_skus pss ON pss.product_id = p.id
    WHERE p.company_id = p_company_id
    AND (
        p.name ILIKE '%' || search_term || '%'
        OR p.sku ILIKE '%' || search_term || '%'
        OR p.barcode ILIKE '%' || search_term || '%'
        OR p.ean ILIKE '%' || search_term || '%'
        OR pss.supplier_sku ILIKE '%' || search_term || '%'
        OR pss.supplier_name ILIKE '%' || search_term || '%'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;
