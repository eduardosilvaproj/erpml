-- Create transfer_orders table
CREATE TABLE public.transfer_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'separando' CHECK (status IN ('separando', 'enviado', 'recebido_full', 'conferido_full', 'cancelado')),
  total_items INTEGER NOT NULL DEFAULT 0,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Create transfer_items table
CREATE TABLE public.transfer_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_order_id UUID NOT NULL REFERENCES public.transfer_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transfer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_items ENABLE ROW LEVEL SECURITY;

-- Public access (internal ERP)
CREATE POLICY "Allow full access to transfer_orders" ON public.transfer_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to transfer_items" ON public.transfer_items FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_transfer_orders_status ON public.transfer_orders(status);
CREATE INDEX idx_transfer_items_order ON public.transfer_items(transfer_order_id);
CREATE INDEX idx_transfer_items_product ON public.transfer_items(product_id);

-- Trigger
CREATE TRIGGER update_transfer_orders_updated_at BEFORE UPDATE ON public.transfer_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();