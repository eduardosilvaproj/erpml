-- Create panel_settings table
CREATE TABLE IF NOT EXISTS public.panel_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.panel_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin_master
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'panel_settings' AND policyname = 'Admin master can manage panel settings'
    ) THEN
        CREATE POLICY "Admin master can manage panel settings" 
        ON public.panel_settings 
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
    END IF;
END $$;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_panel_settings_updated_at') THEN
        CREATE TRIGGER update_panel_settings_updated_at
        BEFORE UPDATE ON public.panel_settings
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;