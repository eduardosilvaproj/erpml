
-- 1) Fix mutable search_path on functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.search_products_with_suppliers(text, uuid) SET search_path = public;
ALTER FUNCTION public.decrementar_estoque(uuid, integer, uuid) SET search_path = public;
ALTER FUNCTION public.sync_sku_ean() SET search_path = public;
ALTER FUNCTION public.fn_get_next_full_order_number() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.is_admin_master_dev() SET search_path = public;
ALTER FUNCTION public.handle_test_error_status_changes() SET search_path = public;
ALTER FUNCTION public.notify_on_error_assignment() SET search_path = public;
ALTER FUNCTION public.notify_on_new_comment() SET search_path = public;
ALTER FUNCTION public.notify_on_new_critical_error() SET search_path = public;
ALTER FUNCTION public.generate_full_order_number() SET search_path = public;
ALTER FUNCTION public.audit_subscription_note() SET search_path = public;
ALTER FUNCTION public.check_and_log_test_account() SET search_path = public;
ALTER FUNCTION public.admin_create_company(text, uuid, boolean, text, text, text, text, text, text, text) SET search_path = public;

-- 2) Recreate view with security_invoker so it uses caller's RLS instead of owner's
ALTER VIEW public.products_search_view SET (security_invoker = true);

-- 3) Add admin-only read policy on test_account_creations (writes happen via SECURITY DEFINER check_and_log_test_account)
CREATE POLICY "Admins can view test account creations"
ON public.test_account_creations
FOR SELECT
TO authenticated
USING (public.is_admin_master_dev());
