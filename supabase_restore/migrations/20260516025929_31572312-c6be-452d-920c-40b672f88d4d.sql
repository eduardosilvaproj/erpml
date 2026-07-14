-- Histórico de mudanças de plano
CREATE TABLE public.subscription_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    old_plan_id UUID REFERENCES public.plans(id),
    new_plan_id UUID NOT NULL REFERENCES public.plans(id),
    old_value NUMERIC,
    new_value NUMERIC,
    change_type TEXT NOT NULL, -- 'upgrade', 'downgrade', 'initial', 'renewal'
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    actor_id UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- Políticas para Admin Master
CREATE POLICY "Admin Master can view subscription history"
ON public.subscription_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin_master', 'admin_master_dev') 
    AND is_active = true
  )
);

-- Índices
CREATE INDEX idx_sub_history_sub_id ON public.subscription_history(subscription_id);
CREATE INDEX idx_sub_history_company_id ON public.subscription_history(company_id);

-- Trigger para registrar mudança de plano automaticamente
CREATE OR REPLACE FUNCTION public.track_subscription_change()
RETURNS TRIGGER AS $$
DECLARE
    change_type_val TEXT;
BEGIN
    IF (OLD.plan_id IS DISTINCT FROM NEW.plan_id OR OLD.value IS DISTINCT FROM NEW.value) THEN
        IF (NEW.value > OLD.value) THEN
            change_type_val := 'upgrade';
        ELSIF (NEW.value < OLD.value) THEN
            change_type_val := 'downgrade';
        ELSE
            change_type_val := 'plan_change';
        END IF;

        INSERT INTO public.subscription_history (
            subscription_id, 
            company_id, 
            old_plan_id, 
            new_plan_id, 
            old_value, 
            new_value, 
            change_type,
            actor_id
        ) VALUES (
            NEW.id, 
            NEW.company_id, 
            OLD.plan_id, 
            NEW.plan_id, 
            OLD.value, 
            NEW.value, 
            change_type_val,
            auth.uid()
        );
        
        -- Auditoria administrativa
        INSERT INTO public.admin_audit_log (actor_id, target_type, target_id, action, old_value, new_value)
        VALUES (
            auth.uid(),
            'subscription',
            NEW.id,
            'plan_change',
            jsonb_build_object('plan_id', OLD.plan_id, 'value', OLD.value),
            jsonb_build_object('plan_id', NEW.plan_id, 'value', NEW.value)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_track_subscription_change
AFTER UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.track_subscription_change();
