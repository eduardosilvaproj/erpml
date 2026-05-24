-- Manter sku original como SKU interno
-- Criar tabela de SKUs de fornecedores
CREATE TABLE IF NOT EXISTS public.product_supplier_skus (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_name text, -- ex: 'L\'oreal', 'Distribuidora X'
  supplier_sku text,  -- ex: 'LOR-MAJ-60-6.0'
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.product_supplier_skus ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
-- Note: Access is determined by the company of the product it belongs to
CREATE POLICY "Users can view supplier skus for their company's products"
ON public.product_supplier_skus
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.company_members cm ON cm.company_id = p.company_id
    WHERE p.id = product_supplier_skus.product_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage supplier skus for their company's products"
ON public.product_supplier_skus
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.company_members cm ON cm.company_id = p.company_id
    WHERE p.id = product_supplier_skus.product_id
    AND cm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.company_members cm ON cm.company_id = p.company_id
    WHERE p.id = product_supplier_skus.product_id
    AND cm.user_id = auth.uid()
  )
);

-- Add index for better search performance
CREATE INDEX IF NOT EXISTS idx_product_supplier_skus_sku ON public.product_supplier_skus (supplier_sku);
CREATE INDEX IF NOT EXISTS idx_product_supplier_skus_product_id ON public.product_supplier_skus (product_id);
