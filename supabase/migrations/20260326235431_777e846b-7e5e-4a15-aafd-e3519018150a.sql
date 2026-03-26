-- Create conferences table
CREATE TABLE public.conferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'conferida', 'divergente')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conference_items for tracking each scanned item
CREATE TABLE public.conference_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conference_id UUID NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
  invoice_item_id UUID NOT NULL REFERENCES public.invoice_items(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  expected_quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
  scanned_quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ok', 'divergente', 'excedente')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_items ENABLE ROW LEVEL SECURITY;

-- Public access (internal ERP)
CREATE POLICY "Allow full access to conferences" ON public.conferences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to conference_items" ON public.conference_items FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_conferences_invoice ON public.conferences(invoice_id);
CREATE INDEX idx_conferences_status ON public.conferences(status);
CREATE INDEX idx_conference_items_conference ON public.conference_items(conference_id);

-- Trigger for updated_at
CREATE TRIGGER update_conference_items_updated_at BEFORE UPDATE ON public.conference_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();