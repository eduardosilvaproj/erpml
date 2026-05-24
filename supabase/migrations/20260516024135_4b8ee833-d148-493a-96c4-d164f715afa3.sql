-- Ensure role check constraint is flexible or handled
-- The existing 'role' column is 'text', so we just need to use 'admin_master' and 'admin_master_dev'.

-- Create Admin Audit Log for global actions
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id UUID REFERENCES auth.users(id),
    target_type TEXT NOT NULL, -- 'user', 'company', 'billing'
    target_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'activate', 'deactivate', 'change_role', 'update_billing'
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admin_master and admin_master_dev can view logs
CREATE POLICY "Admins can view audit logs" 
ON public.admin_audit_log 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE user_id = auth.uid() 
        AND role IN ('admin_master', 'admin_master_dev') 
        AND is_active = true
    )
);

-- Internal insert only (triggered by functions/logic) - but for now allow direct from authorized roles
CREATE POLICY "Admins can insert audit logs" 
ON public.admin_audit_log 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE user_id = auth.uid() 
        AND role IN ('admin_master', 'admin_master_dev') 
        AND is_active = true
    )
);

-- Ensure we have indices for common lookups
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON public.admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at);

-- Add 'status_history' or similar to companies if missing for better tracking
-- Already have 'status' and 'updated_at', but we'll use audit log for the "why" and "who".

-- Function to check if user is admin_master or admin_master_dev (SQL side)
CREATE OR REPLACE FUNCTION public.is_admin_master()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE user_id = auth.uid() 
        AND role IN ('admin_master', 'admin_master_dev') 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
