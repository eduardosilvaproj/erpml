-- Add foreign key relationship if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'full_orders_separado_por_profiles_fkey'
    ) THEN
        ALTER TABLE public.full_orders 
        ADD CONSTRAINT full_orders_separado_por_profiles_fkey 
        FOREIGN KEY (separado_por) 
        REFERENCES public.profiles(id);
    END IF;
END $$;
