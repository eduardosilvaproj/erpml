-- Refine RLS policies for global Master Admin access

-- 1. Companies Table
DROP POLICY IF EXISTS "Companies UPDATE policy" ON public.companies;
CREATE POLICY "Companies UPDATE policy"
ON public.companies FOR UPDATE
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid() 
    AND cm.company_id = public.companies.id 
    AND cm.role IN ('owner', 'manager', 'admin_master')
    AND cm.is_active = true
  ))
  OR is_admin_master()
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid() 
    AND cm.company_id = public.companies.id 
    AND cm.role IN ('owner', 'manager', 'admin_master')
    AND cm.is_active = true
  ))
  OR is_admin_master()
);

-- 2. Profiles Table
DROP POLICY IF EXISTS "Profiles UPDATE policy" ON public.profiles;
CREATE POLICY "Profiles UPDATE policy"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  (id = auth.uid())
  OR is_admin_master()
)
WITH CHECK (
  (id = auth.uid())
  OR is_admin_master()
);

-- 3. Company Members Table
DROP POLICY IF EXISTS "Company members UPDATE policy" ON public.company_members;
CREATE POLICY "Company members UPDATE policy"
ON public.company_members FOR UPDATE
TO authenticated
USING (
  (company_id = get_my_company_id())
  OR is_admin_master()
)
WITH CHECK (
  (company_id = get_my_company_id())
  OR is_admin_master()
);

DROP POLICY IF EXISTS "Company members DELETE policy" ON public.company_members;
CREATE POLICY "Company members DELETE policy"
ON public.company_members FOR DELETE
TO authenticated
USING (
  (company_id = get_my_company_id())
  OR is_admin_master()
);
