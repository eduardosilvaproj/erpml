-- Add attachments to comments
ALTER TABLE public.test_error_comments ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('test_error_attachments', 'test_error_attachments', false);

-- Enable RLS for the new bucket
CREATE POLICY "Admin Master Dev can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'test_error_attachments' AND public.is_admin_master_dev());

CREATE POLICY "Admin Master Dev can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'test_error_attachments' AND public.is_admin_master_dev());

CREATE POLICY "Admin Master Dev can delete their own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'test_error_attachments' AND auth.uid() = owner AND public.is_admin_master_dev());
