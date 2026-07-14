ALTER TABLE public.order_recordings
DROP CONSTRAINT IF EXISTS order_recordings_responsavel_id_fkey;

ALTER TABLE public.order_recordings
ADD CONSTRAINT order_recordings_responsavel_id_fkey
FOREIGN KEY (responsavel_id) REFERENCES public.profiles(id);