CREATE TABLE IF NOT EXISTS public.admin_panel_state (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.admin_panel_state ENABLE ROW LEVEL SECURITY;

-- Policies for admin_master
CREATE POLICY "Admin master can manage admin_panel_state" 
ON public.admin_panel_state 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.company_members 
        WHERE user_id = auth.uid() 
        AND role = 'admin_master'
        AND is_active = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.company_members 
        WHERE user_id = auth.uid() 
        AND role = 'admin_master'
        AND is_active = true
    )
);

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_admin_panel_state_updated_at') THEN
        CREATE TRIGGER update_admin_panel_state_updated_at
        BEFORE UPDATE ON public.admin_panel_state
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;