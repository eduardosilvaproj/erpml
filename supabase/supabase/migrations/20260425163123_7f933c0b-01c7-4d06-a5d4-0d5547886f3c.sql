-- Create full_order_items if it doesn't exist
CREATE TABLE IF NOT EXISTS public.full_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.full_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for the new table
ALTER TABLE public.full_order_items ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view their own company full_order_items"
    ON public.full_order_items
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.full_orders fo
        WHERE fo.id = full_order_items.order_id
        AND fo.company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    ));

CREATE POLICY "Users can insert their own company full_order_items"
    ON public.full_order_items
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.full_orders fo
        WHERE fo.id = full_order_items.order_id
        AND fo.company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    ));

CREATE POLICY "Users can update their own company full_order_items"
    ON public.full_order_items
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.full_orders fo
        WHERE fo.id = full_order_items.order_id
        AND fo.company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    ));

CREATE POLICY "Users can delete their own company full_order_items"
    ON public.full_order_items
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.full_orders fo
        WHERE fo.id = full_order_items.order_id
        AND fo.company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    ));

-- Ensure cascade delete for full_order_items (re-applying as requested)
ALTER TABLE public.full_order_items 
  DROP CONSTRAINT IF EXISTS full_order_items_order_id_fkey,
  ADD CONSTRAINT full_order_items_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES public.full_orders(id) ON DELETE CASCADE;

-- Handle order_recordings constraint
ALTER TABLE public.order_recordings
  DROP CONSTRAINT IF EXISTS order_recordings_pedido_id_fkey;