ALTER TABLE public.ordens_full
ADD CONSTRAINT ordens_full_atribuido_para_fkey 
FOREIGN KEY (atribuido_para) 
REFERENCES public.profiles(id);