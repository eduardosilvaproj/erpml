-- Create table for tracking test account creations
CREATE TABLE IF NOT EXISTS public.test_account_creations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS but allow anyone to insert via RPC (Security Definer)
ALTER TABLE public.test_account_creations ENABLE ROW LEVEL SECURITY;

-- Create system settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone for settings (or at least some)
CREATE POLICY "Allow public read access to system_settings" ON public.system_settings
    FOR SELECT USING (true);

-- Insert default limit
INSERT INTO public.system_settings (key, value) 
VALUES ('test_account_limit_per_hour', '5')
ON CONFLICT (key) DO NOTHING;

-- Function to check limit and log creation
CREATE OR REPLACE FUNCTION public.check_and_log_test_account()
RETURNS JSONB AS $$
DECLARE
    current_limit INTEGER;
    current_count INTEGER;
    success BOOLEAN;
    message TEXT;
BEGIN
    -- Get limit from settings
    SELECT (value#>>'{}')::INTEGER INTO current_limit 
    FROM public.system_settings 
    WHERE key = 'test_account_limit_per_hour';
    
    IF current_limit IS NULL THEN 
        current_limit := 5; 
    END IF;

    -- Count creations in the last hour
    SELECT count(*) INTO current_count 
    FROM public.test_account_creations 
    WHERE created_at > now() - interval '1 hour';

    IF current_count < current_limit THEN
        INSERT INTO public.test_account_creations DEFAULT VALUES;
        success := TRUE;
        message := 'Limit check passed';
    ELSE
        success := FALSE;
        message := 'Limite de contas de teste por hora atingido. Tente novamente mais tarde.';
    END IF;

    RETURN jsonb_build_object(
        'success', success,
        'message', message,
        'current_count', current_count,
        'limit', current_limit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
