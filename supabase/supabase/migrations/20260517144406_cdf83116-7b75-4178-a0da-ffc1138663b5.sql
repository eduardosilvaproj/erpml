-- Drop the existing function to avoid overloads with different parameter counts
DROP FUNCTION IF EXISTS public.admin_create_company(text, uuid, text, boolean, text, text, text, text, text, text, text);

-- Recreate the function without the p_status parameter
CREATE OR REPLACE FUNCTION public.admin_create_company(
    p_name text,
    p_plan_id uuid,
    p_is_courtesy boolean,
    p_cnpj text,
    p_email text,
    p_phone text,
    p_address text,
    p_city text,
    p_state text,
    p_zip_code text
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company public.companies;
    v_user_id UUID := auth.uid();
BEGIN
    -- Check if user is authenticated and is a master admin
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if user is master admin
    IF NOT public.is_admin_master() THEN
        RAISE EXCEPTION 'Only Master Admins can use this function';
    END IF;

    -- Create the company without explicit status (will use default 'active')
    INSERT INTO public.companies (
        name,
        plan_id,
        is_courtesy,
        cnpj,
        email,
        phone,
        address,
        city,
        state,
        zip_code,
        owner_id
    ) VALUES (
        p_name,
        p_plan_id,
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

    -- Log the action
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