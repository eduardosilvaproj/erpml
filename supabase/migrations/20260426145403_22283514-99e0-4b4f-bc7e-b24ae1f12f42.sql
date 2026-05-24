-- Create stock_movement_logs table
CREATE TABLE public.stock_movement_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'entrada', 'saida', 'ajuste', 'transferencia'
    quantity INTEGER NOT NULL,
    old_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    stock_type TEXT NOT NULL, -- 'physical', 'full'
    reference_id UUID,
    reference_type TEXT, -- 'order', 'invoice', 'transfer', 'manual'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_movement_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view logs of their own company" 
ON public.stock_movement_logs 
FOR SELECT 
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
);

-- Note: We don't usually allow manual INSERT/UPDATE/DELETE on audit logs from the client,
-- but since we are using supabase-js client directly in services, 
-- we need to allow inserts if the user is part of the company.
CREATE POLICY "Users can insert logs for their own company" 
ON public.stock_movement_logs 
FOR INSERT 
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
);

-- Indexes for performance
CREATE INDEX idx_stock_movement_product ON public.stock_movement_logs(product_id);
CREATE INDEX idx_stock_movement_company ON public.stock_movement_logs(company_id);
CREATE INDEX idx_stock_movement_created_at ON public.stock_movement_logs(created_at);