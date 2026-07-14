-- Funcao para sincronizar o company_id no perfil do usuario
CREATE OR REPLACE FUNCTION public.sync_profile_company_id()
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Busca o company_id de um membership ativo (priorizando o mais recente)
    SELECT company_id INTO v_company_id
    FROM public.company_members
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    -- Atualiza o perfil do usuario
    UPDATE public.profiles
    SET company_id = v_company_id
    WHERE id = COALESCE(NEW.user_id, OLD.user_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para sincronizacao automatica
DROP TRIGGER IF EXISTS trigger_sync_profile_company_id ON public.company_members;
CREATE TRIGGER trigger_sync_profile_company_id
AFTER INSERT OR UPDATE OR DELETE ON public.company_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_company_id();

-- Funcao auxiliar para verificar se o usuario e o dono da empresa
CREATE OR REPLACE FUNCTION public.is_company_owner(p_user_id UUID, p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.companies
        WHERE id = p_company_id AND owner_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ajustar a politica de insercao de company_members
DROP POLICY IF EXISTS "Owner or admin can manage members" ON public.company_members;
CREATE POLICY "Owner or admin can manage members"
ON public.company_members
FOR INSERT
TO public
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    is_company_owner(auth.uid(), company_id)
);

-- Garantir que a policy de update e delete tambem use a logica correta
DROP POLICY IF EXISTS "Owner or admin can update members" ON public.company_members;
CREATE POLICY "Owner or admin can update members"
ON public.company_members
FOR UPDATE
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    is_company_owner(auth.uid(), company_id)
);

DROP POLICY IF EXISTS "Owner or admin can delete members" ON public.company_members;
CREATE POLICY "Owner or admin can delete members"
ON public.company_members
FOR DELETE
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    is_company_owner(auth.uid(), company_id)
);
