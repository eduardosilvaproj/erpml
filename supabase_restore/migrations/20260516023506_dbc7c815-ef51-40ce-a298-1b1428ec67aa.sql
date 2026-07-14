-- 1. Update status constraint to include new workflow states
ALTER TABLE public.test_error_reports 
DROP CONSTRAINT IF EXISTS test_error_reports_status_check;

ALTER TABLE public.test_error_reports 
ADD CONSTRAINT test_error_reports_status_check 
CHECK (status = ANY (ARRAY['open'::text, 'triaged'::text, 'in_progress'::text, 'blocked'::text, 'ready_for_validation'::text, 'resolved'::text, 'closed'::text, 'wont_fix'::text]));

-- 2. Create or replace a more comprehensive trigger for timestamps
CREATE OR REPLACE FUNCTION public.update_test_error_workflow_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle timestamps for each status transition
  IF NEW.status = 'triaged' AND (OLD.status IS NULL OR OLD.status != 'triaged') AND NEW.triaged_at IS NULL THEN
    NEW.triaged_at = now();
  ELSIF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') AND NEW.in_progress_at IS NULL THEN
    NEW.in_progress_at = now();
  ELSIF NEW.status = 'blocked' AND (OLD.status IS NULL OR OLD.status != 'blocked') AND NEW.blocked_at IS NULL THEN
    -- Note: Ensure blocked_at column exists or is handled. The current schema has triaged, in_progress, ready_for_validation, resolved, closed.
    -- If blocked_at doesn't exist, we just skip it or log via activity log.
  ELSIF NEW.status = 'ready_for_validation' AND (OLD.status IS NULL OR OLD.status != 'ready_for_validation') AND NEW.ready_for_validation_at IS NULL THEN
    NEW.ready_for_validation_at = now();
  ELSIF NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status != 'resolved') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at = now();
  ELSIF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') AND NEW.closed_at IS NULL THEN
    NEW.closed_at = now();
  END IF;
  
  -- Handle resets if moving back to open (optional but good for testing)
  IF NEW.status = 'open' AND OLD.status != 'open' THEN
    -- We keep historical timestamps but new ones would overwrite if logic above allows
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Database-side Audit Logging Trigger
CREATE OR REPLACE FUNCTION public.log_test_error_activity()
RETURNS TRIGGER AS $$
DECLARE
  audit_user_id UUID;
BEGIN
  -- Try to get current user from auth.uid() or use the last_updated_by field
  audit_user_id := COALESCE(auth.uid(), NEW.last_updated_by);

  -- Log status changes
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.test_error_activity_log (report_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, audit_user_id, 'status', OLD.status, NEW.status);
  END IF;

  -- Log assignment changes
  IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.test_error_activity_log (report_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, audit_user_id, 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text);
  END IF;

  -- Log validator changes
  IF (OLD.validator_id IS DISTINCT FROM NEW.validator_id) THEN
    INSERT INTO public.test_error_activity_log (report_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, audit_user_id, 'validator_id', OLD.validator_id::text, NEW.validator_id::text);
  END IF;

  -- Log technical fields
  IF (OLD.blocker_reason IS DISTINCT FROM NEW.blocker_reason) THEN
    INSERT INTO public.test_error_activity_log (report_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, audit_user_id, 'blocker_reason', OLD.blocker_reason, NEW.blocker_reason);
  END IF;

  IF (OLD.resolution_summary IS DISTINCT FROM NEW.resolution_summary) THEN
    INSERT INTO public.test_error_activity_log (report_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, audit_user_id, 'resolution_summary', OLD.resolution_summary, NEW.resolution_summary);
  END IF;

  IF (OLD.validation_notes IS DISTINCT FROM NEW.validation_notes) THEN
    INSERT INTO public.test_error_activity_log (report_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, audit_user_id, 'validation_notes', OLD.validation_notes, NEW.validation_notes);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers are properly attached
DROP TRIGGER IF EXISTS tr_log_test_error_activity ON public.test_error_reports;
CREATE TRIGGER tr_log_test_error_activity
AFTER UPDATE ON public.test_error_reports
FOR EACH ROW
EXECUTE FUNCTION public.log_test_error_activity();

-- The timestamp trigger is already attached as 'tr_update_test_error_workflow_timestamps' (per prior observation)
-- and 'on_test_error_status_update' (which calls handle_test_error_status_changes).
-- Let's consolidate to one clean trigger for timestamps.

DROP TRIGGER IF EXISTS tr_update_test_error_workflow_timestamps ON public.test_error_reports;
DROP TRIGGER IF EXISTS on_test_error_status_update ON public.test_error_reports;

CREATE TRIGGER tr_update_test_error_workflow_timestamps
BEFORE UPDATE ON public.test_error_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_test_error_workflow_timestamps();
