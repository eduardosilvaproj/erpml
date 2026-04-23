-- Create the order_recordings table
CREATE TABLE IF NOT EXISTS public.order_recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('separacao', 'carregamento')),
  video_url TEXT,
  duracao_segundos INTEGER,
  responsavel_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_recordings ENABLE ROW LEVEL SECURITY;

-- Create policies for order_recordings
CREATE POLICY "Users can view all order recordings"
ON public.order_recordings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own order recordings"
ON public.order_recordings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = responsavel_id);

CREATE POLICY "Users can delete their own order recordings"
ON public.order_recordings FOR DELETE
TO authenticated
USING (auth.uid() = responsavel_id);

-- Create storage bucket for recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('order_recordings', 'order_recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Allow authenticated users to upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order_recordings');

CREATE POLICY "Allow authenticated users to view recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'order_recordings');

CREATE POLICY "Allow authenticated users to delete recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'order_recordings');