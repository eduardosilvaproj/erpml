CREATE OR REPLACE FUNCTION public.admin_assign_company_owner(p_company_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Check if caller is master admin
    IF NOT public.is_admin_master() THEN
        RAISE EXCEPTION 'Only Master Admins can assign owners';
    END IF;

    -- 1. Update company owner_id
    UPDATE public.companies
    SET owner_id = p_user_id
    WHERE id = p_company_id;

    -- 2. Ensure the user is a member with 'owner' role
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

    -- 3. Sync profiles.company_id for consistency
    UPDATE public.profiles
    SET company_id = p_company_id
    WHERE id = p_user_id;

    -- 4. Log the action
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
$function$;