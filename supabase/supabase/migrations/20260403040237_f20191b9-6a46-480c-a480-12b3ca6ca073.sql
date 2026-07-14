DROP POLICY IF EXISTS "Authenticated can insert audit log" ON public.company_audit_log;
CREATE POLICY "Members can insert own company audit log"
ON public.company_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND is_company_member(auth.uid(), company_id)
);