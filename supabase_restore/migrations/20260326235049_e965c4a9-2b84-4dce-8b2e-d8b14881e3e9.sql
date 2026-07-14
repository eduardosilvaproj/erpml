-- Create invoices table for tracking imported NF-e
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT NOT NULL,
  series TEXT,
  issuer_name TEXT,
  issuer_cnpj TEXT,
  total_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'importada' CHECK (status IN ('importada', 'aguardando_conferencia', 'conferida', 'divergente')),
  xml_data TEXT,
  items_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice_items table
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  xml_code TEXT NOT NULL,
  xml_description TEXT NOT NULL,
  quantity NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit_value NUMERIC(12,4) NOT NULL DEFAULT 0,
  total_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  match_type TEXT NOT NULL DEFAULT 'none' CHECK (match_type IN ('exact', 'fuzzy', 'manual', 'new', 'none')),
  match_confidence NUMERIC(5,2) DEFAULT 0,
  stock_updated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Public access (internal ERP, will restrict when auth is added)
CREATE POLICY "Allow full access to invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to invoice_items" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product ON public.invoice_items(product_id);