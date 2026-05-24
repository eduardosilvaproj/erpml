CREATE OR REPLACE FUNCTION public.reset_company_data(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  v_is_owner BOOLEAN;
BEGIN
  -- Check if the current user is the owner of the company
  SELECT EXISTS (
    SELECT 1 FROM public.company_members 
    WHERE company_id = p_company_id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only company owners can reset data';
  END IF;

  -- 1. Conferences
  DELETE FROM public.conference_items WHERE conference_id IN (SELECT id FROM public.conferences WHERE company_id = p_company_id);
  DELETE FROM public.conferences WHERE company_id = p_company_id;

  -- 2. Sales (Orders)
  DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = p_company_id);
  DELETE FROM public.sales WHERE company_id = p_company_id;

  -- 3. ML Orders
  DELETE FROM public.ml_order_items WHERE ml_order_id IN (SELECT id FROM public.ml_orders WHERE company_id = p_company_id);
  DELETE FROM public.ml_orders WHERE company_id = p_company_id;

  -- 4. Full Orders
  DELETE FROM public.ordens_full_itens WHERE ordem_full_id IN (SELECT id FROM public.ordens_full WHERE company_id = p_company_id);
  DELETE FROM public.ordens_full WHERE company_id = p_company_id;

  -- 5. Transfer Orders
  DELETE FROM public.transfer_items WHERE order_id IN (SELECT id FROM public.transfer_orders WHERE company_id = p_company_id);
  DELETE FROM public.transfer_orders WHERE company_id = p_company_id;

  -- 6. Campaigns
  DELETE FROM public.campaign_items WHERE campaign_id IN (SELECT id FROM public.campaigns WHERE company_id = p_company_id);
  DELETE FROM public.campaigns WHERE company_id = p_company_id;

  -- 7. Kits
  DELETE FROM public.kit_items WHERE kit_id IN (SELECT id FROM public.product_kits WHERE company_id = p_company_id);
  DELETE FROM public.product_kits WHERE company_id = p_company_id;

  -- 8. Products and related tables
  DELETE FROM public.product_suppliers WHERE product_id IN (SELECT id FROM public.products WHERE company_id = p_company_id);
  DELETE FROM public.product_watchlist WHERE product_id IN (SELECT id FROM public.products WHERE company_id = p_company_id);
  DELETE FROM public.store_products WHERE product_id IN (SELECT id FROM public.products WHERE company_id = p_company_id);
  DELETE FROM public.ml_linked_products WHERE product_id IN (SELECT id FROM public.products WHERE company_id = p_company_id);
  DELETE FROM public.products WHERE company_id = p_company_id;

  -- 9. Customers
  DELETE FROM public.customers WHERE company_id = p_company_id;

  -- 10. Team Members (except current owner)
  DELETE FROM public.company_members WHERE company_id = p_company_id AND role != 'owner';

  -- 11. Audit log
  DELETE FROM public.company_audit_log WHERE company_id = p_company_id;
  
  -- 12. System logs (if they belong to this company)
  -- Some tables might not have company_id, so we skip if uncertain.
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
