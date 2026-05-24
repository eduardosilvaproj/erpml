-- Add SLA and tracking timestamps
ALTER TABLE public.test_error_reports 
ADD COLUMN triaged_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN sla_status TEXT DEFAULT 'normal' CHECK (sla_status IN ('normal', 'warning', 'overdue'));

-- Create internal notifications for the admin panel
CREATE TABLE public.admin_internal_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'critical', 'success')),
    link_to TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_internal_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin Master Dev can manage their own notifications"
ON public.admin_internal_notifications FOR ALL USING (auth.uid() = user_id AND public.is_admin_master_dev());

-- Indexing for analytic performance
CREATE INDEX idx_error_reports_sla ON public.test_error_reports(sla_status);
CREATE INDEX idx_error_reports_resolved_at ON public.test_error_reports(resolved_at);

-- Update function to handle triage/resolution timestamps
CREATE OR REPLACE FUNCTION public.handle_test_error_status_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Triaged when moved from 'open'
    IF NEW.status != 'open' AND OLD.status = 'open' AND NEW.triaged_at IS NULL THEN
        NEW.triaged_at = now();
    END IF;

    -- Resolved when status is 'resolved'
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        NEW.resolved_at = now();
    ELSIF NEW.status != 'resolved' AND OLD.status = 'resolved' THEN
        NEW.resolved_at = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_test_error_status_update
BEFORE UPDATE ON public.test_error_reports
FOR EACH ROW
EXECUTE FUNCTION public.handle_test_error_status_changes();
