-- Função para sincronizar o company_id no perfil do usuário
CREATE OR REPLACE FUNCTION public.sync_profile_company_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Se for uma inserção ou ativação de membro
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.is_active = true)) THEN
        -- Atualiza o perfil apenas se o perfil ainda não tiver um company_id ou se o novo membership for do tipo owner
        UPDATE public.profiles
        SET company_id = NEW.company_id
        WHERE id = NEW.user_id
        AND (company_id IS NULL OR NEW.role = 'owner');
    
    -- Se for uma deleção ou desativação
    ELSIF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.is_active = false)) THEN
        -- Se o usuário está sendo removido da empresa que está marcada no perfil dele
        UPDATE public.profiles
        SET company_id = (
            SELECT company_id 
            FROM public.company_members 
            WHERE user_id = OLD.user_id 
            AND is_active = true 
            LIMIT 1
        )
        WHERE id = OLD.user_id 
        AND company_id = OLD.company_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers para manter a sincronização
DROP TRIGGER IF EXISTS tr_sync_profile_company_id_insert_update ON public.company_members;
CREATE TRIGGER tr_sync_profile_company_id_insert_update
AFTER INSERT OR UPDATE ON public.company_members
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_company_id();

DROP TRIGGER IF EXISTS tr_sync_profile_company_id_delete ON public.company_members;
CREATE TRIGGER tr_sync_profile_company_id_delete
AFTER DELETE ON public.company_members
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_company_id();

-- Ajuste na política de INSERT de company_members
-- A política atual tem uma dependência que pode falhar durante o onboarding
DROP POLICY IF EXISTS "Owner or admin can manage members" ON public.company_members;
CREATE POLICY "Owner or admin can manage members" 
ON public.company_members 
FOR INSERT 
WITH CHECK (
    -- Permite se o usuário for o owner da empresa sendo referenciada
    (EXISTS (
        SELECT 1 FROM public.companies 
        WHERE id = company_members.company_id 
        AND owner_id = auth.uid()
    ))
    OR 
    -- Ou se for um admin master (role global)
    has_role(auth.uid(), 'admin'::app_role)
);

-- Garante que o usuário que criou a empresa tenha acesso para ver seu próprio membership imediatamente
DROP POLICY IF EXISTS "Members can read own company members" ON public.company_members;
CREATE POLICY "Members can read own company members"
ON public.company_members
FOR SELECT
USING (
    user_id = auth.uid() 
    OR is_company_member(auth.uid(), company_id) 
    OR has_role(auth.uid(), 'admin'::app_role)
);
