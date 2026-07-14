-- Function for Master Admins to create companies without affecting their own profile
CREATE OR REPLACE FUNCTION public.admin_create_company(
    p_name TEXT,
    p_plan_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'active',
    p_is_courtesy BOOLEAN DEFAULT false,
    p_cnpj TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_zip_code TEXT DEFAULT NULL
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_company public.companies;
    v_user_id UUID := auth.uid();
BEGIN
    -- Check if user is authenticated and is a master admin
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Extra safety check (though RLS/Gains should handle this)
    IF NOT public.is_admin_master() THEN
        RAISE EXCEPTION 'Only Master Admins can use this function';
    END IF;

    -- 1. Create the company with NULL owner_id (or we could keep it as the admin, but the request asks not to)
    -- If owner_id is NOT NULL in schema, we might need a placeholder or allow NULL.
    -- Let's check schema first by trying to insert with NULL.
    
    INSERT INTO public.companies (
        name,
        plan_id,
        status,
        is_courtesy,
        cnpj,
        email,
        phone,
        address,
        city,
        state,
        zip_code,
        owner_id -- We set this to NULL if the schema allows it
    ) VALUES (
        p_name,
        p_plan_id,
        p_status,
        p_is_courtesy,
        p_cnpj,
        p_email,
        p_phone,
        p_address,
        p_city,
        p_state,
        p_zip_code,
        NULL
    ) RETURNING * INTO v_company;

    -- 2. We DO NOT update public.profiles.company_id for the admin

    -- 3. Log the action
    INSERT INTO public.company_audit_log (
        company_id,
        user_id,
        action,
        details
    ) VALUES (
        v_company.id,
        v_user_id,
        'company_created_by_admin',
        jsonb_build_object(
            'name', p_name, 
            'plan_id', p_plan_id, 
            'method', 'admin_create_company'
        )
    );

    RETURN v_company;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.admin_create_company TO authenticated;
