-- system_settings: require authentication to read
DROP POLICY IF EXISTS "Allow public read access to system_settings" ON public.system_settings;
CREATE POLICY "Authenticated users can read system_settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

-- full_order_counters: company-scoped policies
CREATE POLICY "tenant_select_counters" ON public.full_order_counters
  FOR SELECT USING (company_id = get_auth_company_id());
CREATE POLICY "tenant_insert_counters" ON public.full_order_counters
  FOR INSERT WITH CHECK (company_id = get_auth_company_id());
CREATE POLICY "tenant_update_counters" ON public.full_order_counters
  FOR UPDATE USING (company_id = get_auth_company_id());

-- system_logs: restrict ALL policy to SELECT only (prevent tampering)
DROP POLICY IF EXISTS "User isolation" ON public.system_logs;
CREATE POLICY "Users can view their own system_logs"
  ON public.system_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
