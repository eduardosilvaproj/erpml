CREATE OR REPLACE FUNCTION public.log_test_error_activity()
RETURNS TRIGGER AS $$
DECLARE
  audit_user_id UUID;
BEGIN
  -- Try to get current user from auth.uid() or use the last_updated_by field
  -- If both are null, we skip or use a system placeholder if allowed, but here we'll just guard against null if needed.
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Also update the test_error_activity_log table to allow null user_id temporarily if needed, 
-- or ensure we always have a user. Let's make it nullable to avoid blocking critical updates.
ALTER TABLE public.test_error_activity_log ALTER COLUMN user_id DROP NOT NULL;
