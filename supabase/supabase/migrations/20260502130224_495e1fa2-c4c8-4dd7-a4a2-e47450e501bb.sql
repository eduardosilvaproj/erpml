-- Function to get the current user's active company ID
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Function to check if the current user is an admin_master
CREATE OR REPLACE FUNCTION public.is_admin_master()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members 
    WHERE user_id = auth.uid() 
    AND role = 'admin_master'
    AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Helper to check if a user is a member of a specific company
CREATE OR REPLACE FUNCTION public.is_member_of(target_company_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members 
    WHERE user_id = auth.uid() 
    AND company_id = target_company_id
    AND is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Enable RLS for all base tables
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- 1. Companies Table
DROP POLICY IF EXISTS "Users can see their own company" ON public.companies;
CREATE POLICY "Users can see their own company" ON public.companies
    FOR SELECT USING (is_member_of(id));

DROP POLICY IF EXISTS "Admins can update their company" ON public.companies;
CREATE POLICY "Admins can update their company" ON public.companies
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.company_members 
            WHERE user_id = auth.uid() AND company_id = id AND role IN ('owner'::public.company_role, 'manager'::public.company_role, 'admin_master'::public.company_role)
        )
    );

-- 2. Profiles Table (Users)
DROP POLICY IF EXISTS "Users can see profiles in their company" ON public.profiles;
CREATE POLICY "Users can see profiles in their company" ON public.profiles
    FOR SELECT USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- 3. Company Members
DROP POLICY IF EXISTS "Members can see other members in same company" ON public.company_members;
CREATE POLICY "Members can see other members in same company" ON public.company_members
    FOR SELECT USING (company_id = get_my_company_id());

-- 4. Admin Panel State (Master only)
DROP POLICY IF EXISTS "Only admin_master can manage admin panel state" ON public.admin_panel_state;
CREATE POLICY "Only admin_master can manage admin panel state" ON public.admin_panel_state
    FOR ALL USING (is_admin_master());

-- 5. Standard Tables with company_id
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN (
        SELECT c.table_name 
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.table_schema = 'public' 
        AND c.column_name = 'company_id' 
        AND c.data_type = 'uuid'
        AND t.table_type = 'BASE TABLE'
        AND c.table_name NOT IN ('profiles', 'company_members', 'admin_panel_state', 'companies')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Company isolation" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Company isolation" ON public.%I FOR ALL USING (company_id = get_my_company_id())', t);
    END LOOP;
END $$;

-- 6. Sub-tables (Items) - Using explicit qualification and aliases
-- campaign_items -> campaigns
DROP POLICY IF EXISTS "Campaign items isolation" ON public.campaign_items;
CREATE POLICY "Campaign items isolation" ON public.campaign_items
    FOR ALL USING (EXISTS (SELECT 1 FROM public.campaigns p WHERE p.id = campaign_items.campaign_id AND p.company_id = get_my_company_id()));

-- full_order_items -> full_orders
DROP POLICY IF EXISTS "Full order items isolation" ON public.full_order_items;
CREATE POLICY "Full order items isolation" ON public.full_order_items
    FOR ALL USING (EXISTS (SELECT 1 FROM public.full_orders p WHERE p.id = full_order_items.order_id AND p.company_id = get_my_company_id()));

-- invoice_items -> invoices
DROP POLICY IF EXISTS "Invoice items isolation" ON public.invoice_items;
CREATE POLICY "Invoice items isolation" ON public.invoice_items
    FOR ALL USING (EXISTS (SELECT 1 FROM public.invoices p WHERE p.id = invoice_items.invoice_id AND p.company_id = get_my_company_id()));

-- invoice_payments -> invoices
DROP POLICY IF EXISTS "Invoice payments isolation" ON public.invoice_payments;
CREATE POLICY "Invoice payments isolation" ON public.invoice_payments
    FOR ALL USING (EXISTS (SELECT 1 FROM public.invoices p WHERE p.id = invoice_payments.invoice_id AND p.company_id = get_my_company_id()));

-- kit_items -> product_kits
DROP POLICY IF EXISTS "Kit items isolation" ON public.kit_items;
CREATE POLICY "Kit items isolation" ON public.kit_items
    FOR ALL USING (EXISTS (SELECT 1 FROM public.product_kits p WHERE p.id = kit_items.kit_id AND p.company_id = get_my_company_id()));

-- ml_order_items -> ml_orders
DROP POLICY IF EXISTS "ML order items isolation" ON public.ml_order_items;
CREATE POLICY "ML order items isolation" ON public.ml_order_items
    FOR ALL USING (EXISTS (SELECT 1 FROM public.ml_orders p WHERE p.id = ml_order_items.ml_order_id AND p.company_id = get_my_company_id()));

-- sale_items -> sales
DROP POLICY IF EXISTS "Sale items isolation" ON public.sale_items;
CREATE POLICY "Sale items isolation" ON public.sale_items
    FOR ALL USING (EXISTS (SELECT 1 FROM public.sales p WHERE p.id = sale_items.sale_id AND p.company_id = get_my_company_id()));

-- store_orders -> seller_stores
DROP POLICY IF EXISTS "Store orders isolation" ON public.store_orders;
CREATE POLICY "Store orders isolation" ON public.store_orders
    FOR ALL USING (EXISTS (SELECT 1 FROM public.seller_stores p WHERE p.id = store_orders.store_id AND p.company_id = get_my_company_id()));

-- store_products -> seller_stores
DROP POLICY IF EXISTS "Store products isolation" ON public.store_products;
CREATE POLICY "Store products isolation" ON public.store_products
    FOR ALL USING (EXISTS (SELECT 1 FROM public.seller_stores p WHERE p.id = store_products.store_id AND p.company_id = get_my_company_id()));

-- transfer_items -> transfer_orders
DROP POLICY IF EXISTS "Transfer items isolation" ON public.transfer_items;
CREATE POLICY "Transfer items isolation" ON public.transfer_items
    FOR ALL USING (EXISTS (SELECT 1 FROM public.transfer_orders p WHERE p.id = transfer_items.transfer_order_id AND p.company_id = get_my_company_id()));

-- product_suppliers -> products
DROP POLICY IF EXISTS "Product suppliers isolation" ON public.product_suppliers;
CREATE POLICY "Product suppliers isolation" ON public.product_suppliers
    FOR ALL USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_suppliers.product_id AND p.company_id = get_my_company_id()));

-- 7. User-specific tables
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN (
        SELECT c.table_name 
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.table_schema = 'public' 
        AND c.column_name = 'user_id' 
        AND c.data_type = 'uuid'
        AND t.table_type = 'BASE TABLE'
        AND c.table_name NOT IN ('company_members', 'ml_orders', 'ml_questions', 'company_audit_log', 'stock_movement_logs', 'profiles')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "User isolation" ON public.%I', t);
        EXECUTE format('CREATE POLICY "User isolation" ON public.%I FOR ALL USING (user_id = auth.uid())', t);
    END LOOP;
END $$;

-- 8. Public Tables
DROP POLICY IF EXISTS "Plans are publicly readable" ON public.plans;
CREATE POLICY "Plans are publicly readable" ON public.plans
    FOR SELECT USING (true);
