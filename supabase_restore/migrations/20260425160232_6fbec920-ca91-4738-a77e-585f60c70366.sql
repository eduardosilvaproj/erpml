-- Strict RLS Policies for remaining tables

-- conferences (if not fully covered)
DROP POLICY IF EXISTS "Users can read own company conferences" ON public.conferences;
DROP POLICY IF EXISTS "Users can update own company conferences" ON public.conferences;
DROP POLICY IF EXISTS "Users can delete own company conferences" ON public.conferences;
DROP POLICY IF EXISTS "company_isolation_select" ON public.conferences;
DROP POLICY IF EXISTS "company_isolation_insert" ON public.conferences;
DROP POLICY IF EXISTS "company_isolation_update" ON public.conferences;
DROP POLICY IF EXISTS "company_isolation_delete" ON public.conferences;

CREATE POLICY "company_isolation_select" ON public.conferences FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.conferences FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_update" ON public.conferences FOR UPDATE USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.conferences FOR DELETE USING (company_id = public.get_auth_company_id());

-- customers
DROP POLICY IF EXISTS "Users can read own company customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update own company customers" ON public.customers;

CREATE POLICY "company_isolation_select" ON public.customers FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.customers FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_update" ON public.customers FOR UPDATE USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.customers FOR DELETE USING (company_id = public.get_auth_company_id());

-- product_gtins
DROP POLICY IF EXISTS "company_isolation_select" ON public.product_gtins;
DROP POLICY IF EXISTS "company_isolation_insert" ON public.product_gtins;
DROP POLICY IF EXISTS "company_isolation_update" ON public.product_gtins;
DROP POLICY IF EXISTS "company_isolation_delete" ON public.product_gtins;

CREATE POLICY "company_isolation_select" ON public.product_gtins FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.product_gtins FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_update" ON public.product_gtins FOR UPDATE USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.product_gtins FOR DELETE USING (company_id = public.get_auth_company_id());

-- product_alternative_gtins
DROP POLICY IF EXISTS "company_isolation_select" ON public.product_alternative_gtins;
DROP POLICY IF EXISTS "company_isolation_insert" ON public.product_alternative_gtins;
DROP POLICY IF EXISTS "company_isolation_update" ON public.product_alternative_gtins;
DROP POLICY IF EXISTS "company_isolation_delete" ON public.product_alternative_gtins;

CREATE POLICY "company_isolation_select" ON public.product_alternative_gtins FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.product_alternative_gtins FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_update" ON public.product_alternative_gtins FOR UPDATE USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.product_alternative_gtins FOR DELETE USING (company_id = public.get_auth_company_id());

-- invoices
DROP POLICY IF EXISTS "Users can read own company invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update own company invoices" ON public.invoices;

CREATE POLICY "company_isolation_select" ON public.invoices FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.invoices FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_update" ON public.invoices FOR UPDATE USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.invoices FOR DELETE USING (company_id = public.get_auth_company_id());

-- sales
DROP POLICY IF EXISTS "Users can read own company sales" ON public.sales;
DROP POLICY IF EXISTS "Users can update own company sales" ON public.sales;

CREATE POLICY "company_isolation_select" ON public.sales FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.sales FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_update" ON public.sales FOR UPDATE USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.sales FOR DELETE USING (company_id = public.get_auth_company_id());

-- categories
DROP POLICY IF EXISTS "Users can read own company categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own company categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own company categories" ON public.categories;

CREATE POLICY "company_isolation_select" ON public.categories FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.categories FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_update" ON public.categories FOR UPDATE USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.categories FOR DELETE USING (company_id = public.get_auth_company_id());
