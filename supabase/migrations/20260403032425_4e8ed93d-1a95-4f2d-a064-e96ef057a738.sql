
-- ============================================================
-- 1. Fix get_user_company_id to be deterministic
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.company_members
  WHERE user_id = _user_id AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1
$$;

-- ============================================================
-- 2. Fix direct tables: remove "company_id IS NULL" from SELECT/UPDATE/DELETE
-- Tables: products, customers, suppliers, invoices, sales, categories,
--         conferences, transfer_orders
-- ============================================================

-- PRODUCTS
DROP POLICY IF EXISTS "Users can read own company products" ON public.products;
CREATE POLICY "Users can read own company products" ON public.products
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own company products" ON public.products;
CREATE POLICY "Users can update own company products" ON public.products
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- CUSTOMERS
DROP POLICY IF EXISTS "Users can read own company customers" ON public.customers;
CREATE POLICY "Users can read own company customers" ON public.customers
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own company customers" ON public.customers;
CREATE POLICY "Users can update own company customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- SUPPLIERS
DROP POLICY IF EXISTS "Users can read own company suppliers" ON public.suppliers;
CREATE POLICY "Users can read own company suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own company suppliers" ON public.suppliers;
CREATE POLICY "Users can update own company suppliers" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- INVOICES
DROP POLICY IF EXISTS "Users can read own company invoices" ON public.invoices;
CREATE POLICY "Users can read own company invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own company invoices" ON public.invoices;
CREATE POLICY "Users can update own company invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- SALES
DROP POLICY IF EXISTS "Users can read own company sales" ON public.sales;
CREATE POLICY "Users can read own company sales" ON public.sales
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own company sales" ON public.sales;
CREATE POLICY "Users can update own company sales" ON public.sales
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- CATEGORIES
DROP POLICY IF EXISTS "Users can read own company categories" ON public.categories;
CREATE POLICY "Users can read own company categories" ON public.categories
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own company categories" ON public.categories;
CREATE POLICY "Users can update own company categories" ON public.categories
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete own company categories" ON public.categories;
CREATE POLICY "Users can delete own company categories" ON public.categories
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- CONFERENCES
DROP POLICY IF EXISTS "Users can read own company conferences" ON public.conferences;
CREATE POLICY "Users can read own company conferences" ON public.conferences
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own company conferences" ON public.conferences;
CREATE POLICY "Users can update own company conferences" ON public.conferences
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete own company conferences" ON public.conferences;
CREATE POLICY "Users can delete own company conferences" ON public.conferences
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- TRANSFER_ORDERS
DROP POLICY IF EXISTS "Users can read own company transfer_orders" ON public.transfer_orders;
CREATE POLICY "Users can read own company transfer_orders" ON public.transfer_orders
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own company transfer_orders" ON public.transfer_orders;
CREATE POLICY "Users can update own company transfer_orders" ON public.transfer_orders
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete own company transfer_orders" ON public.transfer_orders;
CREATE POLICY "Users can delete own company transfer_orders" ON public.transfer_orders
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 3. Fix child tables: remove parent "company_id IS NULL" from joins
-- Tables: invoice_items, invoice_payments, sale_items, conference_items,
--         transfer_items, product_suppliers
-- ============================================================

-- INVOICE_ITEMS
DROP POLICY IF EXISTS "Users can read own company invoice_items" ON public.invoice_items;
CREATE POLICY "Users can read own company invoice_items" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
      AND (invoices.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Users can update own company invoice_items" ON public.invoice_items;
CREATE POLICY "Users can update own company invoice_items" ON public.invoice_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_items.invoice_id
      AND (invoices.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- INVOICE_PAYMENTS
DROP POLICY IF EXISTS "Users can read own company invoice_payments" ON public.invoice_payments;
CREATE POLICY "Users can read own company invoice_payments" ON public.invoice_payments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_payments.invoice_id
      AND (invoices.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Users can update own company invoice_payments" ON public.invoice_payments;
CREATE POLICY "Users can update own company invoice_payments" ON public.invoice_payments
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_payments.invoice_id
      AND (invoices.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- SALE_ITEMS
DROP POLICY IF EXISTS "Users can read own company sale_items" ON public.sale_items;
CREATE POLICY "Users can read own company sale_items" ON public.sale_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_items.sale_id
      AND (sales.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Users can update own company sale_items" ON public.sale_items;
CREATE POLICY "Users can update own company sale_items" ON public.sale_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales
    WHERE sales.id = sale_items.sale_id
      AND (sales.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- CONFERENCE_ITEMS
DROP POLICY IF EXISTS "Users can read own company conference_items" ON public.conference_items;
CREATE POLICY "Users can read own company conference_items" ON public.conference_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conferences
    WHERE conferences.id = conference_items.conference_id
      AND (conferences.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Users can update own company conference_items" ON public.conference_items;
CREATE POLICY "Users can update own company conference_items" ON public.conference_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM conferences
    WHERE conferences.id = conference_items.conference_id
      AND (conferences.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- TRANSFER_ITEMS
DROP POLICY IF EXISTS "Users can read own company transfer_items" ON public.transfer_items;
CREATE POLICY "Users can read own company transfer_items" ON public.transfer_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM transfer_orders
    WHERE transfer_orders.id = transfer_items.transfer_order_id
      AND (transfer_orders.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Users can update own company transfer_items" ON public.transfer_items;
CREATE POLICY "Users can update own company transfer_items" ON public.transfer_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM transfer_orders
    WHERE transfer_orders.id = transfer_items.transfer_order_id
      AND (transfer_orders.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- PRODUCT_SUPPLIERS
DROP POLICY IF EXISTS "Users can read own company product_suppliers" ON public.product_suppliers;
CREATE POLICY "Users can read own company product_suppliers" ON public.product_suppliers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_suppliers.product_id
      AND (products.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Users can update own company product_suppliers" ON public.product_suppliers;
CREATE POLICY "Users can update own company product_suppliers" ON public.product_suppliers
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_suppliers.product_id
      AND (products.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));
