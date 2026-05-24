-- Drop existing FKs
ALTER TABLE public.test_error_reports 
DROP CONSTRAINT test_error_reports_assigned_to_fkey,
DROP CONSTRAINT test_error_reports_reported_by_fkey,
DROP CONSTRAINT test_error_reports_last_updated_by_fkey;

-- Add new FKs pointing to public.profiles
ALTER TABLE public.test_error_reports
ADD CONSTRAINT test_error_reports_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id),
ADD CONSTRAINT test_error_reports_reported_by_fkey 
    FOREIGN KEY (reported_by) REFERENCES public.profiles(id),
ADD CONSTRAINT test_error_reports_last_updated_by_fkey 
    FOREIGN KEY (last_updated_by) REFERENCES public.profiles(id);

-- Also update test_error_comments
ALTER TABLE public.test_error_comments
DROP CONSTRAINT test_error_comments_user_id_fkey;

ALTER TABLE public.test_error_comments
ADD CONSTRAINT test_error_comments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- Also update test_error_activity_log
ALTER TABLE public.test_error_activity_log
DROP CONSTRAINT test_error_activity_log_user_id_fkey;

ALTER TABLE public.test_error_activity_log
ADD CONSTRAINT test_error_activity_log_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id);
