-- Enable global visibility for Master Admins

-- 1. Companies Table
DROP POLICY IF EXISTS "Members can read own company" ON public.companies;
DROP POLICY IF EXISTS "Users can see their own company" ON public.companies;
DROP POLICY IF EXISTS "Admins can update their company" ON public.companies;
DROP POLICY IF EXISTS "Owner or admin can update company" ON public.companies;
DROP POLICY IF EXISTS "Only admins can delete companies" ON public.companies;

CREATE POLICY "Companies SELECT policy"
ON public.companies FOR SELECT
TO authenticated
USING (
  is_member_of(id)
  OR is_admin_master()
);

CREATE POLICY "Companies UPDATE policy"
ON public.companies FOR UPDATE
TO authenticated
USING (
  is_member_of(id) -- Simplified: is_member_of handles role checks in many cases, but for specific roles:
  OR EXISTS (
    SELECT 1 FROM public.company_members 
    WHERE user_id = auth.uid() 
    AND company_id = id 
    AND role IN ('owner', 'manager', 'admin_master')
  )
  OR is_admin_master()
);

CREATE POLICY "Companies DELETE policy"
ON public.companies FOR DELETE
TO authenticated
USING (is_admin_master());


-- 2. Profiles Table
DROP POLICY IF EXISTS "Users can see profiles in their company" ON public.profiles;
DROP POLICY IF EXISTS "Company members can view each other profiles" ON public.profiles;

CREATE POLICY "Profiles SELECT policy"
ON public.profiles FOR SELECT
TO authenticated
USING (
  company_id = get_my_company_id()
  OR is_admin_master()
);


-- 3. Company Members Table
DROP POLICY IF EXISTS "Members can see other members in same company" ON public.company_members;
DROP POLICY IF EXISTS "Members can read own company members" ON public.company_members;

CREATE POLICY "Company members SELECT policy"
ON public.company_members FOR SELECT
TO authenticated
USING (
  company_id = get_my_company_id()
  OR is_admin_master()
);
