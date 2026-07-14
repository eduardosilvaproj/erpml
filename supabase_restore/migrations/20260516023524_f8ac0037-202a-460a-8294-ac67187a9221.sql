-- Set explicit search path for security and to satisfy linter
ALTER FUNCTION public.update_test_error_workflow_timestamps() SET search_path = public;
ALTER FUNCTION public.log_test_error_activity() SET search_path = public;
