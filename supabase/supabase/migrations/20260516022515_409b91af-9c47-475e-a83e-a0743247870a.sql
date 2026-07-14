-- Expand status enum in applications usually requires careful migration. 
-- Assuming we want to support the new statuses in the existing column which is likely a text field with check constraint or just text.

-- Add new columns for enhanced workflow
ALTER TABLE public.test_error_reports 
ADD COLUMN IF NOT EXISTS blocker_reason TEXT,
ADD COLUMN IF NOT EXISTS resolution_summary TEXT,
ADD COLUMN IF NOT EXISTS validation_notes TEXT,
ADD COLUMN IF NOT EXISTS validator_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS in_progress_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ready_for_validation_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- Add comment on columns
COMMENT ON COLUMN public.test_error_reports.blocker_reason IS 'Reason why the incident is blocked';
COMMENT ON COLUMN public.test_error_reports.resolution_summary IS 'Summary of how the incident was resolved';
COMMENT ON COLUMN public.test_error_reports.validation_notes IS 'Notes from the QA/Validator';
COMMENT ON COLUMN public.test_error_reports.validator_id IS 'User responsible for validating the fix';

-- Add a trigger to automatically set timestamps when status changes
CREATE OR REPLACE FUNCTION public.update_test_error_workflow_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status != 'in_progress') THEN
    NEW.in_progress_at = now();
  ELSIF NEW.status = 'ready_for_validation' AND (OLD.status IS NULL OR OLD.status != 'ready_for_validation') THEN
    NEW.ready_for_validation_at = now();
  ELSIF NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status != 'resolved') THEN
    NEW.resolved_at = now();
  ELSIF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    NEW.closed_at = now();
  ELSIF NEW.status = 'triaged' AND (OLD.status IS NULL OR OLD.status != 'triaged') THEN
    NEW.triaged_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_update_test_error_workflow_timestamps ON public.test_error_reports;
CREATE TRIGGER tr_update_test_error_workflow_timestamps
BEFORE UPDATE ON public.test_error_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_test_error_workflow_timestamps();
