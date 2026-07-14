-- First, drop the existing function to ensure we don't have signature conflicts
DROP FUNCTION IF EXISTS public.admin_create_company(text, uuid, boolean, text, text, text, text, text, text, text);

-- Create the function with the requested signature and defaults
CREATE OR REPLACE FUNCTION public.admin_create_company(
  p_name TEXT,
  p_plan_id UUID DEFAULT NULL,
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
AS $$
DECLARE
    v_company public.companies;
    v_user_id UUID := auth.uid();
BEGIN
    -- Check if user is authenticated
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if user is master admin (using the existing security helper)
    IF NOT public.is_admin_master() THEN
        RAISE EXCEPTION 'Only Master Admins can use this function';
    END IF;

    -- Create the company without explicit status (uses default 'active')
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
        NULL -- Owner will be set if necessary by other flows or manually later
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

-- Reload PostgREST schema cache to ensure the new function is visible
NOTIFY pgrst, 'reload schema';