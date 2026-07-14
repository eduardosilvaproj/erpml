
CREATE TABLE public.ml_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_sync_stock boolean NOT NULL DEFAULT true,
  auto_sync_price boolean NOT NULL DEFAULT true,
  auto_sync_orders boolean NOT NULL DEFAULT true,
  auto_suggest_answers boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.ml_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ml_settings"
  ON public.ml_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ml_settings"
  ON public.ml_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ml_settings"
  ON public.ml_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
