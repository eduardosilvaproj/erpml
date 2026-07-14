-- Create technical comments table
CREATE TABLE public.test_error_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES public.test_error_reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activity log for error reports
CREATE TABLE public.test_error_activity_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES public.test_error_reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create saved filters table
CREATE TABLE public.test_error_saved_filters (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    filters JSONB NOT NULL,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add tracking fields to main table
ALTER TABLE public.test_error_reports 
ADD COLUMN last_updated_by UUID REFERENCES auth.users(id);

-- Enable RLS
ALTER TABLE public.test_error_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_error_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_error_saved_filters ENABLE ROW LEVEL SECURITY;

-- Policies (Reuse is_admin_master_dev helper from previous migration)
CREATE POLICY "Admin Master Dev can manage error comments"
ON public.test_error_comments FOR ALL USING (public.is_admin_master_dev());

CREATE POLICY "Admin Master Dev can view error activity logs"
ON public.test_error_activity_log FOR SELECT USING (public.is_admin_master_dev());

CREATE POLICY "Admin Master Dev can manage saved filters"
ON public.test_error_saved_filters FOR ALL USING (auth.uid() = user_id AND public.is_admin_master_dev());

-- Index for performance
CREATE INDEX idx_error_comments_report ON public.test_error_comments(report_id);
CREATE INDEX idx_error_activity_report ON public.test_error_activity_log(report_id);
CREATE INDEX idx_error_reports_assigned ON public.test_error_reports(assigned_to);
CREATE INDEX idx_error_reports_status_severity ON public.test_error_reports(status, severity);
