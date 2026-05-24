
-- =============================================
-- Fix RLS on 6 child tables for multi-tenant isolation
-- Each child table's policies now check company_id via parent table join
-- =============================================

-- 1. TRANSFER_ITEMS (parent: transfer_orders)
DROP POLICY IF EXISTS "Authenticated users can read transfer_items" ON public.transfer_items;
DROP POLICY IF EXISTS "Authenticated users can insert transfer_items" ON public.transfer_items;
DROP POLICY IF EXISTS "Authenticated users can update transfer_items" ON public.transfer_items;
DROP POLICY IF EXISTS "Authenticated users can delete transfer_items" ON public.transfer_items;

CREATE POLICY "Users can read own company transfer_items" ON public.transfer_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_orders
      WHERE transfer_orders.id = transfer_items.transfer_order_id
        AND (transfer_orders.company_id = get_user_company_id(auth.uid()) OR transfer_orders.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can insert own company transfer_items" ON public.transfer_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transfer_orders
      WHERE transfer_orders.id = transfer_items.transfer_order_id
        AND (transfer_orders.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can update own company transfer_items" ON public.transfer_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_orders
      WHERE transfer_orders.id = transfer_items.transfer_order_id
        AND (transfer_orders.company_id = get_user_company_id(auth.uid()) OR transfer_orders.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Only admins can delete transfer_items" ON public.transfer_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 2. INVOICE_ITEMS (parent: invoices)
DROP POLICY IF EXISTS "Authenticated users can read invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated users can insert invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated users can update invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Only admins can delete invoice_items" ON public.invoice_items;

CREATE POLICY "Users can read own company invoice_items" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND (invoices.company_id = get_user_company_id(auth.uid()) OR invoices.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can insert own company invoice_items" ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND (invoices.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can update own company invoice_items" ON public.invoice_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND (invoices.company_id = get_user_company_id(auth.uid()) OR invoices.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Only admins can delete invoice_items" ON public.invoice_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 3. SALE_ITEMS (parent: sales)
DROP POLICY IF EXISTS "Authenticated users can read sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can insert sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can update sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Only admins can delete sale_items" ON public.sale_items;

CREATE POLICY "Users can read own company sale_items" ON public.sale_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE sales.id = sale_items.sale_id
        AND (sales.company_id = get_user_company_id(auth.uid()) OR sales.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can insert own company sale_items" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE sales.id = sale_items.sale_id
        AND (sales.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can update own company sale_items" ON public.sale_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE sales.id = sale_items.sale_id
        AND (sales.company_id = get_user_company_id(auth.uid()) OR sales.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Only admins can delete sale_items" ON public.sale_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 4. CONFERENCE_ITEMS (parent: conferences)
DROP POLICY IF EXISTS "Authenticated users can read conference_items" ON public.conference_items;
DROP POLICY IF EXISTS "Authenticated users can insert conference_items" ON public.conference_items;
DROP POLICY IF EXISTS "Authenticated users can update conference_items" ON public.conference_items;
DROP POLICY IF EXISTS "Authenticated users can delete conference_items" ON public.conference_items;

CREATE POLICY "Users can read own company conference_items" ON public.conference_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conferences
      WHERE conferences.id = conference_items.conference_id
        AND (conferences.company_id = get_user_company_id(auth.uid()) OR conferences.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can insert own company conference_items" ON public.conference_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conferences
      WHERE conferences.id = conference_items.conference_id
        AND (conferences.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can update own company conference_items" ON public.conference_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conferences
      WHERE conferences.id = conference_items.conference_id
        AND (conferences.company_id = get_user_company_id(auth.uid()) OR conferences.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Only admins can delete conference_items" ON public.conference_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 5. PRODUCT_SUPPLIERS (parent: products)
DROP POLICY IF EXISTS "Authenticated users can read product_suppliers" ON public.product_suppliers;
DROP POLICY IF EXISTS "Authenticated users can insert product_suppliers" ON public.product_suppliers;
DROP POLICY IF EXISTS "Authenticated users can update product_suppliers" ON public.product_suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete product_suppliers" ON public.product_suppliers;

CREATE POLICY "Users can read own company product_suppliers" ON public.product_suppliers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_suppliers.product_id
        AND (products.company_id = get_user_company_id(auth.uid()) OR products.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can insert own company product_suppliers" ON public.product_suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_suppliers.product_id
        AND (products.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can update own company product_suppliers" ON public.product_suppliers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_suppliers.product_id
        AND (products.company_id = get_user_company_id(auth.uid()) OR products.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Only admins can delete product_suppliers" ON public.product_suppliers
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 6. INVOICE_PAYMENTS (parent: invoices)
DROP POLICY IF EXISTS "Authenticated users can read invoice_payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Authenticated users can insert invoice_payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Authenticated users can update invoice_payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Only admins can delete invoice_payments" ON public.invoice_payments;

CREATE POLICY "Users can read own company invoice_payments" ON public.invoice_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_payments.invoice_id
        AND (invoices.company_id = get_user_company_id(auth.uid()) OR invoices.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can insert own company invoice_payments" ON public.invoice_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_payments.invoice_id
        AND (invoices.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can update own company invoice_payments" ON public.invoice_payments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_payments.invoice_id
        AND (invoices.company_id = get_user_company_id(auth.uid()) OR invoices.company_id IS NULL OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Only admins can delete invoice_payments" ON public.invoice_payments
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
