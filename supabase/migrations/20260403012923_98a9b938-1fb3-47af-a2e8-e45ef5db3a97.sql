
-- Fix: Remove the self-insert bypass from company_members INSERT policy
DROP POLICY IF EXISTS "Owner or admin can manage members" ON public.company_members;

CREATE POLICY "Owner or admin can manage members" ON public.company_members
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_members.company_id AND owner_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );
