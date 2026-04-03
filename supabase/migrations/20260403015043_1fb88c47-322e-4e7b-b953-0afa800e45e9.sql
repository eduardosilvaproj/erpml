
-- 1. Create helper function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_members
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1
$$;

-- 2. Add company_id to main tables
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.transfer_orders ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.conferences ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_company_id ON public.sales(company_id);
CREATE INDEX IF NOT EXISTS idx_categories_company_id ON public.categories(company_id);
CREATE INDEX IF NOT EXISTS idx_transfer_orders_company_id ON public.transfer_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_conferences_company_id ON public.conferences(company_id);

-- 4. Update RLS policies for PRODUCTS
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Only admins can delete products" ON public.products;

CREATE POLICY "Users can read own company products" ON public.products
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company products" ON public.products
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete products" ON public.products
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Update RLS policies for CUSTOMERS
DROP POLICY IF EXISTS "Authenticated users can read customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Only admins can delete customers" ON public.customers;

CREATE POLICY "Users can read own company customers" ON public.customers
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Update RLS policies for SUPPLIERS
DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Only admins can delete suppliers" ON public.suppliers;

CREATE POLICY "Users can read own company suppliers" ON public.suppliers
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company suppliers" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company suppliers" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete suppliers" ON public.suppliers
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. Update RLS policies for INVOICES
DROP POLICY IF EXISTS "Authenticated users can read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Only admins can delete invoices" ON public.invoices;

CREATE POLICY "Users can read own company invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. Update RLS policies for SALES
DROP POLICY IF EXISTS "Authenticated users can read sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can update sales" ON public.sales;
DROP POLICY IF EXISTS "Only admins can delete sales" ON public.sales;

CREATE POLICY "Users can read own company sales" ON public.sales
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company sales" ON public.sales
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete sales" ON public.sales
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. Update RLS policies for CATEGORIES
DROP POLICY IF EXISTS "Authenticated users can read categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON public.categories;

CREATE POLICY "Users can read own company categories" ON public.categories
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company categories" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company categories" ON public.categories
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own company categories" ON public.categories
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

-- 10. Update RLS policies for TRANSFER_ORDERS
DROP POLICY IF EXISTS "Authenticated users can read transfer_orders" ON public.transfer_orders;
DROP POLICY IF EXISTS "Authenticated users can insert transfer_orders" ON public.transfer_orders;
DROP POLICY IF EXISTS "Authenticated users can update transfer_orders" ON public.transfer_orders;
DROP POLICY IF EXISTS "Authenticated users can delete transfer_orders" ON public.transfer_orders;

CREATE POLICY "Users can read own company transfer_orders" ON public.transfer_orders
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company transfer_orders" ON public.transfer_orders
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company transfer_orders" ON public.transfer_orders
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own company transfer_orders" ON public.transfer_orders
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

-- 11. Update RLS policies for CONFERENCES
DROP POLICY IF EXISTS "Authenticated users can read conferences" ON public.conferences;
DROP POLICY IF EXISTS "Authenticated users can insert conferences" ON public.conferences;
DROP POLICY IF EXISTS "Authenticated users can update conferences" ON public.conferences;
DROP POLICY IF EXISTS "Authenticated users can delete conferences" ON public.conferences;

CREATE POLICY "Users can read own company conferences" ON public.conferences
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company conferences" ON public.conferences
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company conferences" ON public.conferences
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own company conferences" ON public.conferences
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR company_id IS NULL OR has_role(auth.uid(), 'admin'::app_role));
