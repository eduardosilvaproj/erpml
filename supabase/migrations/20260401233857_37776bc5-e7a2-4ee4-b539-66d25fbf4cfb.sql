
-- Table for storing ML OAuth credentials per user
CREATE TABLE public.ml_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ml_user_id TEXT NOT NULL,
  seller_nickname TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.ml_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ML connection"
ON public.ml_connections FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ML connection"
ON public.ml_connections FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ML connection"
ON public.ml_connections FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ML connection"
ON public.ml_connections FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_ml_connections_updated_at
BEFORE UPDATE ON public.ml_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for linking local products to ML listings
CREATE TABLE public.ml_linked_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ml_item_id TEXT NOT NULL,
  ml_title TEXT,
  ml_price NUMERIC,
  ml_available_quantity INTEGER,
  ml_status TEXT DEFAULT 'active',
  last_synced_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, ml_item_id)
);

ALTER TABLE public.ml_linked_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own linked products"
ON public.ml_linked_products FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create linked products"
ON public.ml_linked_products FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own linked products"
ON public.ml_linked_products FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own linked products"
ON public.ml_linked_products FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_ml_linked_products_updated_at
BEFORE UPDATE ON public.ml_linked_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for sync operation logs
CREATE TABLE public.ml_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  details TEXT,
  items_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ml_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
ON public.ml_sync_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create sync logs"
ON public.ml_sync_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
