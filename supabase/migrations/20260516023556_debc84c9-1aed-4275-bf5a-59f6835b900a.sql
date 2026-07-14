CREATE OR REPLACE FUNCTION public.update_test_error_workflow_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle timestamps for each status transition based on existing columns in test_error_reports
  IF NEW.status = 'triaged' AND (OLD.status IS NULL OR OLD.status != 'triaged') AND NEW.triaged_at IS NULL THEN
    NEW.triaged_at = now();
  ELSIF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') AND NEW.in_progress_at IS NULL THEN
    NEW.in_progress_at = now();
  ELSIF NEW.status = 'ready_for_validation' AND (OLD.status IS NULL OR OLD.status != 'ready_for_validation') AND NEW.ready_for_validation_at IS NULL THEN
    NEW.ready_for_validation_at = now();
  ELSIF NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status != 'resolved') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at = now();
  ELSIF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') AND NEW.closed_at IS NULL THEN
    NEW.closed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
