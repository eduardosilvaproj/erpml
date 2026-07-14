-- Função para sincronizar o company_id no perfil do usuário
CREATE OR REPLACE FUNCTION public.sync_profile_company_id()
RETURNS TRIGGER AS $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Busca o company_id de um membership ativo (priorizando o mais recente se houver múltiplos, o que não deve ocorrer)
    SELECT company_id INTO v_company_id
    FROM public.company_members
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    -- Atualiza o perfil do usuário
    UPDATE public.profiles
    SET company_id = v_company_id
    WHERE id = COALESCE(NEW.user_id, OLD.user_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para sincronização automática
DROP TRIGGER IF EXISTS trigger_sync_profile_company_id ON public.company_members;
CREATE TRIGGER trigger_sync_profile_company_id
AFTER INSERT OR UPDATE OR DELETE ON public.company_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_company_id();

-- Função auxiliar para verificar se o usuário é o dono da empresa
CREATE OR REPLACE FUNCTION public.is_company_owner(p_user_id UUID, p_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.companies
        WHERE id = p_company_id AND owner_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ajustar a política de inserção de company_members
-- A política atual 'Owner or admin can manage members' usa EXISTS em companies que pode falhar se o RLS de companies bloquear.
-- Vamos garantir que o usuário consiga inserir a si mesmo se ele for o owner_id da empresa.

DROP POLICY IF EXISTS "Owner or admin can manage members" ON public.company_members;
CREATE POLICY "Owner or admin can manage members"
ON public.company_members
FOR INSERT
TO public
WITH CHECK (
    -- Permite se for um administrador master (assumindo que has_role já existe e funciona)
    has_role(auth.uid(), 'admin'::app_role) OR
    -- Permite se o usuário que está inserindo for o dono da empresa no registro da tabela companies
    -- Usamos a função SECURITY DEFINER para evitar recursão de RLS
    is_company_owner(auth.uid(), company_id)
);

-- Garantir que a policy de update e delete também use a lógica correta
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
