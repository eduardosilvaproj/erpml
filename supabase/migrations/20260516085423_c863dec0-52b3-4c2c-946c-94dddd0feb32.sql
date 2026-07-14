-- 1. Function to assign a company owner (Master Admin only)
CREATE OR REPLACE FUNCTION public.admin_assign_company_owner(
    p_company_id UUID,
    p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Check if caller is master admin
    IF NOT public.is_admin_master() THEN
        RAISE EXCEPTION 'Only Master Admins can assign owners';
    END IF;

    -- Update company owner_id
    UPDATE public.companies
    SET owner_id = p_user_id
    WHERE id = p_company_id;

    -- Ensure the user is a member with 'owner' role
    -- First, remove any existing active memberships for this user in this company to avoid conflicts
    UPDATE public.company_members
    SET is_active = false
    WHERE user_id = p_user_id AND company_id = p_company_id;

    -- Insert or update the owner membership
    INSERT INTO public.company_members (
        company_id,
        user_id,
        role,
        is_active
    ) VALUES (
        p_company_id,
        p_user_id,
        'owner',
        true
    )
    ON CONFLICT (company_id, user_id) 
    DO UPDATE SET 
        role = 'owner',
        is_active = true;

    -- Log the action
    INSERT INTO public.company_audit_log (
        company_id,
        user_id,
        action,
        details
    ) VALUES (
        p_company_id,
        auth.uid(),
        'owner_assigned_by_admin',
        jsonb_build_object('assigned_user_id', p_user_id)
    );
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.admin_assign_company_owner(UUID, UUID) TO authenticated;

-- 2. Function to list all profiles (Master Admin only) for selection
-- This is useful when the Master Admin needs to pick an owner
CREATE OR REPLACE FUNCTION public.admin_get_all_profiles()
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT * FROM public.profiles WHERE is_admin_master() = true OR EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = profiles.id);
$$;

-- Actually, we can just use the profiles table if RLS allows it.
-- Let's ensure Master Admin can see ALL profiles.

DROP POLICY IF EXISTS "Profiles SELECT policy" ON public.profiles;
CREATE POLICY "Profiles SELECT policy"
ON public.profiles FOR SELECT
TO authenticated
USING (
  company_id = get_my_company_id()
  OR is_admin_master()
);
