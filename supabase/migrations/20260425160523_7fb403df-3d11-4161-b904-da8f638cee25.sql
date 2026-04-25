CREATE OR REPLACE FUNCTION public.decrementar_estoque(
  p_product_id uuid,
  p_quantidade integer,
  p_company_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE public.products
  SET stock_physical = GREATEST(0, stock_physical - p_quantidade)
  WHERE id = p_product_id
  AND company_id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;