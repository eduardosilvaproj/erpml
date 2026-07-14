
-- Add policy allowing company members to view each other's profiles
CREATE POLICY "Company members can view each other profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm1
      JOIN public.company_members cm2 ON cm1.company_id = cm2.company_id
      WHERE cm1.user_id = auth.uid()
        AND cm2.user_id = profiles.id
        AND cm1.is_active = true
        AND cm2.is_active = true
    )
  );

-- Drop the old narrower SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
