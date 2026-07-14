-- Histórico de eventos de assinatura
CREATE TABLE public.subscription_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'billing.created', 'payment.confirmed', 'payment.failed', 'subscription.cancelled', etc
    provider TEXT NOT NULL, -- 'asaas', 'stripe', 'manual'
    external_id TEXT, -- ID do evento no gateway
    payload JSONB, -- Dados brutos do evento
    amount NUMERIC,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notas administrativas de faturamento
CREATE TABLE public.subscription_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_notes ENABLE ROW LEVEL SECURITY;

-- Políticas para Admin Master
CREATE POLICY "Admin Master can manage subscription events"
ON public.subscription_events
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin_master', 'admin_master_dev') 
    AND is_active = true
  )
);

CREATE POLICY "Admin Master can manage subscription notes"
ON public.subscription_notes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND role IN ('admin_master', 'admin_master_dev') 
    AND is_active = true
  )
);

-- Índices para performance
CREATE INDEX idx_subscription_events_sub_id ON public.subscription_events(subscription_id);
CREATE INDEX idx_subscription_events_company_id ON public.subscription_events(company_id);
CREATE INDEX idx_subscription_notes_sub_id ON public.subscription_notes(subscription_id);

-- Trigger de Auditoria para Notas
CREATE OR REPLACE FUNCTION public.audit_subscription_note()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.admin_audit_log (actor_id, target_type, target_id, action, new_value)
    VALUES (
        NEW.author_id,
        'subscription_note',
        NEW.subscription_id,
        'create_note',
        jsonb_build_object('content', NEW.content)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_audit_subscription_note
AFTER INSERT ON public.subscription_notes
FOR EACH ROW
EXECUTE FUNCTION public.audit_subscription_note();
