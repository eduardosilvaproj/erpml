-- Add is_test column to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

-- Update create_company_v2 to support test mode
CREATE OR REPLACE FUNCTION public.create_company_v2(
    p_name TEXT,
    p_plan_id UUID,
    p_user_id UUID DEFAULT auth.uid(),
    p_is_test BOOLEAN DEFAULT false
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_company public.companies;
    v_status public.company_status := 'active';
BEGIN
    -- Check if user is authenticated
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- If it's a test company, start as suspended
    IF p_is_test THEN
        v_status := 'suspended';
    END IF;

    -- 1. Create the company
    INSERT INTO public.companies (
        name,
        plan_id,
        owner_id,
        status,
        is_test
    ) VALUES (
        p_name,
        p_plan_id,
        p_user_id,
        v_status,
        p_is_test
    ) RETURNING * INTO v_company;

    -- 2. Add owner as member
    INSERT INTO public.company_members (
        company_id,
        user_id,
        role,
        is_active
    ) VALUES (
        v_company.id,
        p_user_id,
        'owner',
        true
    );

    -- 3. Update profile's company_id for immediate RLS access
    UPDATE public.profiles
    SET company_id = v_company.id
    WHERE id = p_user_id;

    -- 4. Log the action
    INSERT INTO public.company_audit_log (
        company_id,
        user_id,
        action,
        details
    ) VALUES (
        v_company.id,
        p_user_id,
        'company_created',
        jsonb_build_object('name', p_name, 'plan_id', p_plan_id, 'is_test', p_is_test, 'method', 'create_company_v2')
    );

    RETURN v_company;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_company_v2(TEXT, UUID, UUID, BOOLEAN) TO authenticated;

-- Function for Master Admin to activate a test company
CREATE OR REPLACE FUNCTION public.admin_activate_company(
    p_company_id UUID,
    p_plan_id UUID,
    p_is_courtesy BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Check if caller is master admin
    IF NOT public.is_admin_master() THEN
        RAISE EXCEPTION 'Only Master Admins can activate companies';
    END IF;

    UPDATE public.companies
    SET 
        status = 'active',
        is_test = false,
        plan_id = p_plan_id,
        is_courtesy = p_is_courtesy,
        updated_at = now()
    WHERE id = p_company_id;

    -- Log the action
    INSERT INTO public.company_audit_log (
        company_id,
        user_id,
        action,
        details
    ) VALUES (
        p_company_id,
        auth.uid(),
        'company_activated_by_admin',
        jsonb_build_object('plan_id', p_plan_id, 'is_courtesy', p_is_courtesy)
    );
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.admin_activate_company(UUID, UUID, BOOLEAN) TO authenticated;
