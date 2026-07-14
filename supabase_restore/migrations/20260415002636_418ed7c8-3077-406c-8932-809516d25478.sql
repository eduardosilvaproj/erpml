
-- Enum for sale mode
CREATE TYPE public.store_sale_mode AS ENUM ('mercadolivre', 'proprio', 'hibrido');

-- Enum for store payment method
CREATE TYPE public.store_payment_method AS ENUM ('pix', 'cartao', 'boleto');

-- Enum for store payment status
CREATE TYPE public.store_payment_status AS ENUM ('pendente', 'pago', 'cancelado', 'expirado');

-- seller_stores table
CREATE TABLE public.seller_stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#8B5CF6',
  description TEXT,
  whatsapp TEXT,
  sale_mode store_sale_mode NOT NULL DEFAULT 'hibrido',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active stores" ON public.seller_stores
  FOR SELECT USING (is_active = true OR company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Company members can insert store" ON public.seller_stores
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Company members can update own store" ON public.seller_stores
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete stores" ON public.seller_stores
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- store_products table
CREATE TABLE public.store_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_price NUMERIC,
  custom_description TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, product_id)
);

ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible store products" ON public.store_products
  FOR SELECT USING (
    is_visible = true 
    OR EXISTS (SELECT 1 FROM seller_stores WHERE id = store_products.store_id AND company_id = get_user_company_id(auth.uid()))
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Company members can insert store products" ON public.store_products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM seller_stores WHERE id = store_products.store_id AND company_id = get_user_company_id(auth.uid()))
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Company members can update store products" ON public.store_products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM seller_stores WHERE id = store_products.store_id AND company_id = get_user_company_id(auth.uid()))
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Only admins can delete store products" ON public.store_products
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- store_orders table
CREATE TABLE public.store_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.seller_stores(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_cpf TEXT NOT NULL,
  buyer_phone TEXT,
  buyer_address JSONB,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  payment_method store_payment_method,
  payment_status store_payment_status NOT NULL DEFAULT 'pendente',
  asaas_payment_id TEXT,
  asaas_customer_id TEXT,
  asaas_invoice_url TEXT,
  asaas_pix_qrcode TEXT,
  asaas_pix_copy_paste TEXT,
  asaas_bank_slip_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

-- Public can insert orders (checkout is public)
CREATE POLICY "Anyone can create store orders" ON public.store_orders
  FOR INSERT WITH CHECK (true);

-- Store owner can view their orders
CREATE POLICY "Store owner can view orders" ON public.store_orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM seller_stores WHERE id = store_orders.store_id AND company_id = get_user_company_id(auth.uid()))
    OR has_role(auth.uid(), 'admin')
  );

-- Store owner can update orders
CREATE POLICY "Store owner can update orders" ON public.store_orders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM seller_stores WHERE id = store_orders.store_id AND company_id = get_user_company_id(auth.uid()))
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Only admins can delete store orders" ON public.store_orders
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_seller_stores_updated_at BEFORE UPDATE ON public.seller_stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_products_updated_at BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_orders_updated_at BEFORE UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for slug lookup
CREATE INDEX idx_seller_stores_slug ON public.seller_stores(slug);
CREATE INDEX idx_store_orders_store_id ON public.store_orders(store_id);
CREATE INDEX idx_store_orders_payment_status ON public.store_orders(payment_status);
