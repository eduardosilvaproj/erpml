
-- 1. Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Replace ALL permissive RLS policies with auth-required ones

-- categories
DROP POLICY IF EXISTS "Allow full access to categories" ON public.categories;
CREATE POLICY "Authenticated users can read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update categories" ON public.categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete categories" ON public.categories FOR DELETE TO authenticated USING (true);

-- customers
DROP POLICY IF EXISTS "Allow full access to customers" ON public.customers;
CREATE POLICY "Authenticated users can read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update customers" ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete customers" ON public.customers FOR DELETE TO authenticated USING (true);

-- products
DROP POLICY IF EXISTS "Allow full access to products" ON public.products;
CREATE POLICY "Authenticated users can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update products" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete products" ON public.products FOR DELETE TO authenticated USING (true);

-- suppliers
DROP POLICY IF EXISTS "Allow full access to suppliers" ON public.suppliers;
CREATE POLICY "Authenticated users can read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (true);

-- invoices
DROP POLICY IF EXISTS "Allow full access to invoices" ON public.invoices;
CREATE POLICY "Authenticated users can read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (true);

-- invoice_items
DROP POLICY IF EXISTS "Allow full access to invoice_items" ON public.invoice_items;
CREATE POLICY "Authenticated users can read invoice_items" ON public.invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert invoice_items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update invoice_items" ON public.invoice_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete invoice_items" ON public.invoice_items FOR DELETE TO authenticated USING (true);

-- sales
DROP POLICY IF EXISTS "Allow full access to sales" ON public.sales;
CREATE POLICY "Authenticated users can read sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sales" ON public.sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete sales" ON public.sales FOR DELETE TO authenticated USING (true);

-- sale_items
DROP POLICY IF EXISTS "Allow full access to sale_items" ON public.sale_items;
CREATE POLICY "Authenticated users can read sale_items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update sale_items" ON public.sale_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete sale_items" ON public.sale_items FOR DELETE TO authenticated USING (true);

-- conferences
DROP POLICY IF EXISTS "Allow full access to conferences" ON public.conferences;
CREATE POLICY "Authenticated users can read conferences" ON public.conferences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert conferences" ON public.conferences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update conferences" ON public.conferences FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete conferences" ON public.conferences FOR DELETE TO authenticated USING (true);

-- conference_items
DROP POLICY IF EXISTS "Allow full access to conference_items" ON public.conference_items;
CREATE POLICY "Authenticated users can read conference_items" ON public.conference_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert conference_items" ON public.conference_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update conference_items" ON public.conference_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete conference_items" ON public.conference_items FOR DELETE TO authenticated USING (true);

-- transfer_orders
DROP POLICY IF EXISTS "Allow full access to transfer_orders" ON public.transfer_orders;
CREATE POLICY "Authenticated users can read transfer_orders" ON public.transfer_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert transfer_orders" ON public.transfer_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update transfer_orders" ON public.transfer_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete transfer_orders" ON public.transfer_orders FOR DELETE TO authenticated USING (true);

-- transfer_items
DROP POLICY IF EXISTS "Allow full access to transfer_items" ON public.transfer_items;
CREATE POLICY "Authenticated users can read transfer_items" ON public.transfer_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert transfer_items" ON public.transfer_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update transfer_items" ON public.transfer_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete transfer_items" ON public.transfer_items FOR DELETE TO authenticated USING (true);

-- product_suppliers
DROP POLICY IF EXISTS "Allow full access to product_suppliers" ON public.product_suppliers;
CREATE POLICY "Authenticated users can read product_suppliers" ON public.product_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product_suppliers" ON public.product_suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_suppliers" ON public.product_suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete product_suppliers" ON public.product_suppliers FOR DELETE TO authenticated USING (true);
