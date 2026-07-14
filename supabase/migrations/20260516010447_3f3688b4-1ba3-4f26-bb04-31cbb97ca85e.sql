-- Create admin_users table
CREATE TABLE public.admin_users (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    role TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create test_error_reports table
CREATE TABLE public.test_error_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    module TEXT NOT NULL,
    route TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL CHECK (status IN ('open', 'triaged', 'in_progress', 'resolved', 'wont_fix')),
    environment TEXT NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
    reproduction_steps TEXT,
    expected_behavior TEXT,
    observed_behavior TEXT,
    root_cause_notes TEXT,
    fix_scope TEXT,
    systemic_impact TEXT,
    reported_by UUID NOT NULL REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_error_reports ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is admin_master_dev
CREATE OR REPLACE FUNCTION public.is_admin_master_dev()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role = 'admin_master_dev'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for admin_users
CREATE POLICY "Admin users can view their own record"
ON public.admin_users
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admin Master Dev can manage all admin users"
ON public.admin_users
FOR ALL
USING (public.is_admin_master_dev());

-- Policies for test_error_reports
CREATE POLICY "Admin Master Dev can manage test error reports"
ON public.test_error_reports
FOR ALL
USING (public.is_admin_master_dev());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_test_error_reports_updated_at
BEFORE UPDATE ON public.test_error_reports
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
