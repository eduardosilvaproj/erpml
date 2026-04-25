-- Update suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS razao_social TEXT,
ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
ADD COLUMN IF NOT EXISTS ie TEXT,
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS logradouro TEXT,
ADD COLUMN IF NOT EXISTS numero TEXT,
ADD COLUMN IF NOT EXISTS bairro TEXT,
ADD COLUMN IF NOT EXISTS municipio TEXT,
ADD COLUMN IF NOT EXISTS uf TEXT,
ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual';

-- Fill razao_social with existing name data if empty
UPDATE public.suppliers SET razao_social = name WHERE razao_social IS NULL AND name IS NOT NULL;

-- Ensure UNIQUE constraint on cnpj and company_id for suppliers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_cnpj_company_id_key'
    ) THEN
        ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_cnpj_company_id_key UNIQUE (cnpj, company_id);
    END IF;
END $$;

-- Update product_supplier_skus table
ALTER TABLE public.product_supplier_skus
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id),
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Add UNIQUE constraint on product_id and supplier_id for product_supplier_skus
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_supplier_skus_product_id_supplier_id_key'
    ) THEN
        ALTER TABLE public.product_supplier_skus ADD CONSTRAINT product_supplier_skus_product_id_supplier_id_key UNIQUE (product_id, supplier_id);
    END IF;
END $$;
