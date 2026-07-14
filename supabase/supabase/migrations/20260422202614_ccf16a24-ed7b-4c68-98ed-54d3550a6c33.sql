CREATE OR REPLACE FUNCTION public.reset_company_data(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_owner BOOLEAN;
  v_company_exists BOOLEAN;
BEGIN
  -- 1. Pre-check: p_company_id must not be null
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'O ID da empresa é obrigatório para realizar o reset.';
  END IF;

  -- 2. Pre-check: company must exist
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id) INTO v_company_exists;
  IF NOT v_company_exists THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  -- 3. Check if the current user is the owner of the company
  SELECT EXISTS (
    SELECT 1 FROM public.company_members 
    WHERE company_id = p_company_id 
    AND user_id = auth.uid() 
    AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Apenas o proprietário da empresa pode resetar os dados.';
  END IF;

  -- 4. Delete Data - All strictly scoped to p_company_id
  
  -- Conferences
  DELETE FROM public.conference_items WHERE conference_id IN (SELECT id FROM public.conferences WHERE company_id = p_company_id);
  DELETE FROM public.conferences WHERE company_id = p_company_id;

  -- Sales and Orders
  DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = p_company_id);
  DELETE FROM public.sales WHERE company_id = p_company_id;
  
  -- Store Data
  DELETE FROM public.store_orders WHERE store_id IN (SELECT id FROM public.seller_stores WHERE company_id = p_company_id);
  DELETE FROM public.store_products WHERE store_id IN (SELECT id FROM public.seller_stores WHERE company_id = p_company_id);
  DELETE FROM public.seller_stores WHERE company_id = p_company_id;

  -- Mercado Livre Operational Data (ONLY company specific)
  DELETE FROM public.ml_order_items WHERE ml_order_id IN (SELECT id FROM public.ml_orders WHERE company_id = p_company_id);
  DELETE FROM public.ml_orders WHERE company_id = p_company_id;
  DELETE FROM public.ml_questions WHERE company_id = p_company_id;
  DELETE FROM public.ml_linked_products WHERE product_id IN (SELECT id FROM public.products WHERE company_id = p_company_id);
  DELETE FROM public.ml_settings WHERE company_id = p_company_id;
  
  -- Note: ml_connections and ml_sync_logs are user-level, we DO NOT delete them here 
  -- to avoid affecting other companies for the same user.

  -- Full Logistics
  DELETE FROM public.ordens_full_itens WHERE ordem_id IN (SELECT id FROM public.ordens_full WHERE company_id = p_company_id);
  DELETE FROM public.ordens_full WHERE company_id = p_company_id;
  DELETE FROM public.envio_pendente WHERE company_id = p_company_id;
  DELETE FROM public.gravacoes_full WHERE company_id = p_company_id;

  -- Transfers and Stock
  DELETE FROM public.transfer_items WHERE transfer_order_id IN (SELECT id FROM public.transfer_orders WHERE company_id = p_company_id);
  DELETE FROM public.transfer_orders WHERE company_id = p_company_id;

  -- Campaigns and Kits
  DELETE FROM public.campaign_items WHERE campaign_id IN (SELECT id FROM public.campaigns WHERE company_id = p_company_id);
  DELETE FROM public.campaigns WHERE company_id = p_company_id;
  DELETE FROM public.kit_items WHERE kit_id IN (SELECT id FROM public.product_kits WHERE company_id = p_company_id);
  DELETE FROM public.product_kits WHERE company_id = p_company_id;

  -- Financial
  DELETE FROM public.invoice_payments WHERE invoice_id IN (SELECT id FROM public.invoices WHERE company_id = p_company_id);
  DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE company_id = p_company_id);
  DELETE FROM public.invoices WHERE company_id = p_company_id;
  DELETE FROM public.payment_logs WHERE company_id = p_company_id;
  DELETE FROM public.subscriptions WHERE company_id = p_company_id;

  -- Products and Catalog
  DELETE FROM public.product_suppliers WHERE product_id IN (SELECT id FROM public.products WHERE company_id = p_company_id);
  DELETE FROM public.product_watchlist WHERE company_id = p_company_id;
  DELETE FROM public.products WHERE company_id = p_company_id;
  DELETE FROM public.categories WHERE company_id = p_company_id;

  -- External Entities
  DELETE FROM public.customers WHERE company_id = p_company_id;
  DELETE FROM public.suppliers WHERE company_id = p_company_id;

  -- Team and Audit
  DELETE FROM public.company_members WHERE company_id = p_company_id AND role != 'owner';
  DELETE FROM public.company_audit_log WHERE company_id = p_company_id;
  
END;
$function$;