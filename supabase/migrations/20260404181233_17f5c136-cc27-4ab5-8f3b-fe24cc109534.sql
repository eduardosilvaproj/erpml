-- Restrict UPDATE to admin-only (edge functions use service_role)
DROP POLICY IF EXISTS "Users can update own ML connection" ON public.ml_connections;
CREATE POLICY "Only admins can update ML connections"
  ON public.ml_connections
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Restrict DELETE to admin-only
DROP POLICY IF EXISTS "Users can delete own ML connection" ON public.ml_connections;
CREATE POLICY "Only admins can delete ML connections"
  ON public.ml_connections
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Keep INSERT for user self-creation but restrict to own records
DROP POLICY IF EXISTS "Users can create own ML connection" ON public.ml_connections;
CREATE POLICY "Users can create own ML connection"
  ON public.ml_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);