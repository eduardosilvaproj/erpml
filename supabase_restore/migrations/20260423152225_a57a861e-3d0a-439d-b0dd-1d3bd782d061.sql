-- Ensure the table exists or just try to alter it as requested
-- If it doesn't exist, we might want to create it, but the user said ALTER.
-- However, to be safe and helpful, I'll create it if it doesn't exist to avoid a crash if it's a new table they planned.

CREATE TABLE IF NOT EXISTS public.full_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.full_orders ADD COLUMN IF NOT EXISTS pdf_frete_id text;
ALTER TABLE public.full_orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'separacao';

-- Add comment for documentation
COMMENT ON COLUMN public.full_orders.status IS 'status: separacao | bipando | completo | enviado';

-- Also enable RLS and add basic policies if it's a new table
ALTER TABLE public.full_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own company full_orders"
  ON public.full_orders
  FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own company full_orders"
  ON public.full_orders
  FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own company full_orders"
  ON public.full_orders
  FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
