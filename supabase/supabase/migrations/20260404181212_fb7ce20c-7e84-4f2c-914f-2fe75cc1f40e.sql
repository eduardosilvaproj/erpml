-- Remove the permissive SELECT policy that exposes tokens to client
DROP POLICY IF EXISTS "Users can view own ML connection" ON public.ml_connections;

-- Create a new SELECT policy that only allows admins (service_role bypasses RLS anyway)
CREATE POLICY "Only admins can view ML connections"
  ON public.ml_connections
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));