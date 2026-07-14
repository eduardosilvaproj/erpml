
-- Subscriptions table to track Asaas payments
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.plans(id) NOT NULL,
  asaas_customer_id TEXT,
  asaas_subscription_id TEXT,
  asaas_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  billing_type TEXT,
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  next_due_date DATE,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Company owners/managers can view their subscriptions
CREATE POLICY "Company members can view subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

-- Only backend (service role) creates/updates subscriptions
-- No INSERT/UPDATE/DELETE policies for regular users

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Payment history log
CREATE TABLE public.payment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  asaas_payment_id TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  value NUMERIC(10,2),
  payment_method TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view payment logs"
  ON public.payment_logs FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins can view all payment logs"
  ON public.payment_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
