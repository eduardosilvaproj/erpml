ALTER TABLE public.conferences ADD COLUMN IF NOT EXISTS type text DEFAULT 'full';
ALTER TABLE public.conferences ADD COLUMN IF NOT EXISTS section_name text;

-- Add comment to columns for clarity
COMMENT ON COLUMN public.conferences.type IS 'Type of conference: full or partial';
COMMENT ON COLUMN public.conferences.section_name IS 'Name of the section being conferred in partial conferences';
