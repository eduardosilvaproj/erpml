
-- Create a security definer function to check company membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_company_member(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE user_id = _user_id
      AND company_id = _company_id
  )
$$;

-- Drop the recursive SELECT policy
DROP POLICY IF EXISTS "Members can read own company members" ON public.company_members;

-- Create a non-recursive SELECT policy using the security definer function
CREATE POLICY "Members can read own company members"
ON public.company_members
FOR SELECT
TO authenticated
USING (
  is_company_member(auth.uid(), company_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Also fix the INSERT policy for company_members to allow owner to add themselves during company creation
DROP POLICY IF EXISTS "Owner or admin can manage members" ON public.company_members;
CREATE POLICY "Owner or admin can manage members"
ON public.company_members
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM companies WHERE id = company_id AND owner_id = auth.uid()
  ))
  OR EXISTS (
    SELECT 1 FROM companies WHERE id = company_id AND owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);
