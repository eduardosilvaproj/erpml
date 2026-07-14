CREATE OR REPLACE FUNCTION public.reset_company_data(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- 2. Sales and Orders
  DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = p_company_id);
  DELETE FROM public.sales WHERE company_id = p_company_id;
  
  -- 3. Store Data
  DELETE FROM public.store_orders WHERE store_id IN (SELECT id FROM public.seller_stores WHERE company_id = p_company_id);
  DELETE FROM public.store_products WHERE store_id IN (SELECT id FROM public.seller_stores WHERE company_id = p_company_id);
  DELETE FROM public.seller_stores WHERE company_id = p_company_id;

  -- 4. Mercado Livre Data
  DELETE FROM public.ml_order_items WHERE ml_order_id IN (SELECT id FROM public.ml_orders WHERE company_id = p_company_id);
  DELETE FROM public.ml_orders WHERE company_id = p_company_id;
  DELETE FROM public.ml_questions WHERE company_id = p_company_id;
  DELETE FROM public.ml_linked_products WHERE product_id IN (SELECT id FROM public.products WHERE company_id = p_company_id);
  DELETE FROM public.ml_settings WHERE company_id = p_company_id;
  DELETE FROM public.ml_sync_logs WHERE user_id IN (SELECT user_id FROM public.company_members WHERE company_id = p_company_id);
  DELETE FROM public.ml_connections WHERE user_id IN (SELECT user_id FROM public.company_members WHERE company_id = p_company_id);

  -- 5. Full Logistics
  DELETE FROM public.ordens_full_itens WHERE ordem_id IN (SELECT id FROM public.ordens_full WHERE company_id = p_company_id);
  DELETE FROM public.ordens_full WHERE company_id = p_company_id;
  DELETE FROM public.envio_pendente WHERE company_id = p_company_id;
  DELETE FROM public.gravacoes_full WHERE company_id = p_company_id;

  -- 6. Transfers and Stock
  DELETE FROM public.transfer_items WHERE transfer_order_id IN (SELECT id FROM public.transfer_orders WHERE company_id = p_company_id);
  DELETE FROM public.transfer_orders WHERE company_id = p_company_id;

  -- 7. Campaigns and Kits
  DELETE FROM public.campaign_items WHERE campaign_id IN (SELECT id FROM public.campaigns WHERE company_id = p_company_id);
  DELETE FROM public.campaigns WHERE company_id = p_company_id;
  DELETE FROM public.kit_items WHERE kit_id IN (SELECT id FROM public.product_kits WHERE company_id = p_company_id);
  DELETE FROM public.product_kits WHERE company_id = p_company_id;

  -- 8. Financial
  DELETE FROM public.invoice_payments WHERE invoice_id IN (SELECT id FROM public.invoices WHERE company_id = p_company_id);
  DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE company_id = p_company_id);
  DELETE FROM public.invoices WHERE company_id = p_company_id;
  DELETE FROM public.payment_logs WHERE company_id = p_company_id;
  DELETE FROM public.subscriptions WHERE company_id = p_company_id;

  -- 9. Products and Catalog
  DELETE FROM public.product_suppliers WHERE product_id IN (SELECT id FROM public.products WHERE company_id = p_company_id);
  DELETE FROM public.product_watchlist WHERE company_id = p_company_id;
  DELETE FROM public.products WHERE company_id = p_company_id;
  DELETE FROM public.categories WHERE company_id = p_company_id;

  -- 10. External Entities
  DELETE FROM public.customers WHERE company_id = p_company_id;
  DELETE FROM public.suppliers WHERE company_id = p_company_id;

  -- 11. Team and Audit
  DELETE FROM public.company_members WHERE company_id = p_company_id AND role != 'owner';
  DELETE FROM public.company_audit_log WHERE company_id = p_company_id;
  
END;
$function$;