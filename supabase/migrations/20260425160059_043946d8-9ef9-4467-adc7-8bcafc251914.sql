-- 1. Add company_id to profiles and sync
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Sync company_id from company_members to profiles for existing users
UPDATE public.profiles p
SET company_id = cm.company_id
FROM public.company_members cm
WHERE p.id = cm.user_id AND cm.is_active = true AND p.company_id IS NULL;

-- 2. Add company_id to missing related tables
ALTER TABLE public.order_recordings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.conference_items ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.ordens_full_itens ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- 3. Populate missing company_id from parent tables
UPDATE public.order_recordings r
SET company_id = o.company_id
FROM public.ordens_full o
WHERE r.pedido_id = o.id::text AND r.company_id IS NULL;

UPDATE public.conference_items ci
SET company_id = c.company_id
FROM public.conferences c
WHERE ci.conference_id = c.id AND ci.company_id IS NULL;

UPDATE public.ordens_full_itens ofi
SET company_id = o.company_id
FROM public.ordens_full o
WHERE ofi.ordem_id = o.id AND ofi.company_id IS NULL;

-- 4. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_full_orders_company_id ON public.full_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_conferences_company_id ON public.conferences(company_id);
CREATE INDEX IF NOT EXISTS idx_order_recordings_company_id ON public.order_recordings(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- 5. Helper function for RLS
CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS uuid AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 6. Strict RLS Policies
-- full_orders
DROP POLICY IF EXISTS "company_isolation_select" ON public.full_orders;
DROP POLICY IF EXISTS "company_isolation_insert" ON public.full_orders;
DROP POLICY IF EXISTS "company_isolation_update" ON public.full_orders;
DROP POLICY IF EXISTS "company_isolation_delete" ON public.full_orders;
DROP POLICY IF EXISTS "Users can view their own company full_orders" ON public.full_orders;
DROP POLICY IF EXISTS "Users can insert their own company full_orders" ON public.full_orders;
DROP POLICY IF EXISTS "Users can update their own company full_orders" ON public.full_orders;

CREATE POLICY "company_isolation_select" ON public.full_orders FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.full_orders FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_update" ON public.full_orders FOR UPDATE USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.full_orders FOR DELETE USING (company_id = public.get_auth_company_id());

-- products
DROP POLICY IF EXISTS "Users can read own company products" ON public.products;
DROP POLICY IF EXISTS "Users can update own company products" ON public.products;
DROP POLICY IF EXISTS "company_isolation_select" ON public.products;
DROP POLICY IF EXISTS "company_isolation_insert" ON public.products;
DROP POLICY IF EXISTS "company_isolation_update" ON public.products;
DROP POLICY IF EXISTS "company_isolation_delete" ON public.products;

CREATE POLICY "company_isolation_select" ON public.products FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.products FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_update" ON public.products FOR UPDATE USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.products FOR DELETE USING (company_id = public.get_auth_company_id());

-- order_recordings
DROP POLICY IF EXISTS "Users can view all order recordings" ON public.order_recordings;
DROP POLICY IF EXISTS "Users can insert their own order recordings" ON public.order_recordings;
DROP POLICY IF EXISTS "Users can delete their own order recordings" ON public.order_recordings;
DROP POLICY IF EXISTS "company_isolation_select" ON public.order_recordings;
DROP POLICY IF EXISTS "company_isolation_insert" ON public.order_recordings;
DROP POLICY IF EXISTS "company_isolation_delete" ON public.order_recordings;

CREATE POLICY "company_isolation_select" ON public.order_recordings FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.order_recordings FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.order_recordings FOR DELETE USING (company_id = public.get_auth_company_id());

-- conference_items
DROP POLICY IF EXISTS "company_isolation_select" ON public.conference_items;
DROP POLICY IF EXISTS "company_isolation_insert" ON public.conference_items;
DROP POLICY IF EXISTS "company_isolation_update" ON public.conference_items;
DROP POLICY IF EXISTS "company_isolation_delete" ON public.conference_items;

CREATE POLICY "company_isolation_select" ON public.conference_items FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.conference_items FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_update" ON public.conference_items FOR UPDATE USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.conference_items FOR DELETE USING (company_id = public.get_auth_company_id());

-- ordens_full_itens
DROP POLICY IF EXISTS "Members can view order items" ON public.ordens_full_itens;
DROP POLICY IF EXISTS "Owner/manager can delete order items" ON public.ordens_full_itens;
DROP POLICY IF EXISTS "Owner/manager can insert order items" ON public.ordens_full_itens;
DROP POLICY IF EXISTS "Owner/manager or assignee can update order items" ON public.ordens_full_itens;
DROP POLICY IF EXISTS "company_isolation_select" ON public.ordens_full_itens;
DROP POLICY IF EXISTS "company_isolation_insert" ON public.ordens_full_itens;
DROP POLICY IF EXISTS "company_isolation_update" ON public.ordens_full_itens;
DROP POLICY IF EXISTS "company_isolation_delete" ON public.ordens_full_itens;

CREATE POLICY "company_isolation_select" ON public.ordens_full_itens FOR SELECT USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_insert" ON public.ordens_full_itens FOR INSERT WITH CHECK (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_update" ON public.ordens_full_itens FOR UPDATE USING (company_id = public.get_auth_company_id());
CREATE POLICY "company_isolation_delete" ON public.ordens_full_itens FOR DELETE USING (company_id = public.get_auth_company_id());
