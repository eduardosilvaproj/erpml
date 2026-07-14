ALTER TABLE public.ml_settings
  ADD COLUMN IF NOT EXISTS auto_sync_full_orders boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS full_sync_interval text DEFAULT '15min';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ml_settings_full_sync_interval_check'
  ) THEN
    ALTER TABLE public.ml_settings
      ADD CONSTRAINT ml_settings_full_sync_interval_check
      CHECK (full_sync_interval IN ('15min', '30min', '1h', '6h'));
  END IF;
END $$;

COMMENT ON COLUMN public.ml_settings.auto_sync_full_orders IS 'Sincroniza pedidos do Mercado Livre Full automaticamente';
COMMENT ON COLUMN public.ml_settings.full_sync_interval IS 'Intervalo da sincronização automática de pedidos Full';