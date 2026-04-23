-- Create a table for alternative GTINs
CREATE TABLE public.product_alternative_gtins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    gtin TEXT NOT NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add an index for faster lookups
CREATE INDEX idx_product_alternative_gtins_gtin ON public.product_alternative_gtins(gtin);
CREATE INDEX idx_product_alternative_gtins_company_id ON public.product_alternative_gtins(company_id);

-- Enable Row Level Security
ALTER TABLE public.product_alternative_gtins ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
-- Note: Reusing the same logic as other tables, assuming members of a company can see its data
CREATE POLICY "Company members can view alternative GTINs" 
ON public.product_alternative_gtins 
FOR SELECT 
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Company members can create alternative GTINs" 
ON public.product_alternative_gtins 
FOR INSERT 
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Company members can update alternative GTINs" 
ON public.product_alternative_gtins 
FOR UPDATE 
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Company members can delete alternative GTINs" 
ON public.product_alternative_gtins 
FOR DELETE 
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
);
