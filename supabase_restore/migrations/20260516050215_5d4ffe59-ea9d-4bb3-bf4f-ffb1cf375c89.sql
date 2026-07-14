-- Function to create a company and set up ownership in a single transaction
CREATE OR REPLACE FUNCTION public.create_company_v2(
    p_name TEXT,
    p_plan_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_company public.companies;
BEGIN
    -- Check if user is authenticated
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Create the company
    INSERT INTO public.companies (
        name,
        plan_id,
        owner_id,
        status
    ) VALUES (
        p_name,
        p_plan_id,
        p_user_id,
        'active'
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
        jsonb_build_object('name', p_name, 'plan_id', p_plan_id, 'method', 'create_company_v2')
    );

    RETURN v_company;
END;
$$;

-- Ensure the function is accessible to authenticated users
GRANT EXECUTE ON FUNCTION public.create_company_v2(TEXT, UUID, UUID) TO authenticated;

-- Update company_members policy to allow inserting the first member (the owner)
-- The current policy 'Owner or admin can manage members' requires being owner first,
-- which is a catch-22.
-- We add a policy that allows a user to insert themselves as an owner if they ARE the company's owner_id.
CREATE POLICY "Users can add themselves as owner of their company"
ON public.company_members
FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND 
    role = 'owner' AND 
    EXISTS (
        SELECT 1 FROM public.companies 
        WHERE id = company_id AND owner_id = auth.uid()
    )
);

-- Ensure profiles can be updated with company_id by the user themselves
-- There might be a conflict with existing policies, let's make sure it's allowed.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can set their own company_id'
    ) THEN
        CREATE POLICY "Users can set their own company_id"
        ON public.profiles
        FOR UPDATE
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;
