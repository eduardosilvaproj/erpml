
-- Table: ml_orders (persisted Mercado Livre orders)
CREATE TABLE public.ml_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  ml_order_id bigint NOT NULL,
  ml_buyer_nickname text,
  ml_buyer_id bigint,
  status text NOT NULL DEFAULT 'unknown',
  total_amount numeric NOT NULL DEFAULT 0,
  currency_id text DEFAULT 'BRL',
  shipping_cost numeric DEFAULT 0,
  marketplace_fee numeric DEFAULT 0,
  date_created timestamp with time zone,
  date_closed timestamp with time zone,
  shipping_status text,
  shipping_id bigint,
  pack_id bigint,
  ml_raw jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, ml_order_id)
);

ALTER TABLE public.ml_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company ml_orders" ON public.ml_orders
  FOR SELECT TO authenticated
  USING ((company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company ml_orders" ON public.ml_orders
  FOR INSERT TO authenticated
  WITH CHECK ((company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company ml_orders" ON public.ml_orders
  FOR UPDATE TO authenticated
  USING ((company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete ml_orders" ON public.ml_orders
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Table: ml_order_items (items within each ML order)
CREATE TABLE public.ml_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_order_id uuid NOT NULL REFERENCES public.ml_orders(id) ON DELETE CASCADE,
  ml_item_id text NOT NULL,
  ml_item_title text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  sku text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ml_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company ml_order_items" ON public.ml_order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ml_orders
    WHERE ml_orders.id = ml_order_items.ml_order_id
      AND ((ml_orders.company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can insert own company ml_order_items" ON public.ml_order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ml_orders
    WHERE ml_orders.id = ml_order_items.ml_order_id
      AND ((ml_orders.company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can update own company ml_order_items" ON public.ml_order_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ml_orders
    WHERE ml_orders.id = ml_order_items.ml_order_id
      AND ((ml_orders.company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Only admins can delete ml_order_items" ON public.ml_order_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast order lookup
CREATE INDEX idx_ml_orders_user_ml ON public.ml_orders (user_id, ml_order_id);
CREATE INDEX idx_ml_orders_company ON public.ml_orders (company_id);
CREATE INDEX idx_ml_order_items_order ON public.ml_order_items (ml_order_id);
