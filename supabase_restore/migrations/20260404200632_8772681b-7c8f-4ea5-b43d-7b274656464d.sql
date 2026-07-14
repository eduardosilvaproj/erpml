
-- Create product_kits table
CREATE TABLE public.product_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create kit_items table (components of a kit)
CREATE TABLE public.kit_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id UUID NOT NULL REFERENCES public.product_kits(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;

-- RLS for product_kits
CREATE POLICY "Users can read own company kits" ON public.product_kits
  FOR SELECT TO authenticated
  USING ((company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company kits" ON public.product_kits
  FOR INSERT TO authenticated
  WITH CHECK ((company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company kits" ON public.product_kits
  FOR UPDATE TO authenticated
  USING ((company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete kits" ON public.product_kits
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for kit_items (via parent kit)
CREATE POLICY "Users can read own company kit_items" ON public.kit_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM product_kits WHERE product_kits.id = kit_items.kit_id
    AND ((product_kits.company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can insert own company kit_items" ON public.kit_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM product_kits WHERE product_kits.id = kit_items.kit_id
    AND ((product_kits.company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can update own company kit_items" ON public.kit_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM product_kits WHERE product_kits.id = kit_items.kit_id
    AND ((product_kits.company_id = get_user_company_id(auth.uid())) OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Only admins can delete kit_items" ON public.kit_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger for product_kits
CREATE TRIGGER update_product_kits_updated_at
  BEFORE UPDATE ON public.product_kits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
