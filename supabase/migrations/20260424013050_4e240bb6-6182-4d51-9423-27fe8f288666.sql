-- Create a view for easier searching
CREATE OR REPLACE VIEW public.products_search_view AS
SELECT 
    p.*,
    (
        SELECT string_agg(supplier_sku, ' ') 
        FROM public.product_supplier_skus 
        WHERE product_id = p.id
    ) as all_supplier_skus,
    (
        SELECT string_agg(supplier_name, ' ') 
        FROM public.product_supplier_skus 
        WHERE product_id = p.id
    ) as all_supplier_names
FROM public.products p;

-- Policy for the view (Supabase views inherit RLS from tables, but sometimes need explicit ones or it just works if tables have RLS)
-- Since it's a view on products, it should follow products' RLS.
