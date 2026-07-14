
-- Create product watchlist table
CREATE TABLE public.product_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  category TEXT,
  avg_cost NUMERIC DEFAULT 0,
  suggested_price NUMERIC DEFAULT 0,
  margin_percent NUMERIC DEFAULT 0,
  demand_level TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_watchlist ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped to company
CREATE POLICY "Users can read own company watchlist"
  ON public.product_watchlist FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company watchlist"
  ON public.product_watchlist FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company watchlist"
  ON public.product_watchlist FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete watchlist items"
  ON public.product_watchlist FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (user_id = auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_product_watchlist_updated_at
  BEFORE UPDATE ON public.product_watchlist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
