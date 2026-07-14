
-- Create plan_type enum
CREATE TYPE public.plan_type AS ENUM ('free', 'basic', 'premium');

-- Create company_status enum
CREATE TYPE public.company_status AS ENUM ('active', 'suspended', 'cancelled');

-- Create company_role enum
CREATE TYPE public.company_role AS ENUM ('owner', 'manager', 'member');

-- Plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug plan_type NOT NULL UNIQUE,
  price numeric NOT NULL DEFAULT 0,
  max_users integer NOT NULL DEFAULT 1,
  max_products integer NOT NULL DEFAULT 50,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  plan_id uuid REFERENCES public.plans(id),
  status company_status NOT NULL DEFAULT 'active',
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Company members table
CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role company_role NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Company audit log
CREATE TABLE public.company_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_audit_log ENABLE ROW LEVEL SECURITY;

-- Plans: readable by all authenticated, managed by admins
CREATE POLICY "Anyone authenticated can read plans" ON public.plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can insert plans" ON public.plans
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can update plans" ON public.plans
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can delete plans" ON public.plans
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Companies: members can read their own company, admins can read all
CREATE POLICY "Members can read own company" ON public.companies
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.company_members WHERE company_id = companies.id AND user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "Authenticated users can create companies" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner or admin can update company" ON public.companies
  FOR UPDATE TO authenticated USING (
    owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "Only admins can delete companies" ON public.companies
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Company members: members can read their company's members, admins can read all
CREATE POLICY "Members can read own company members" ON public.company_members
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = company_members.company_id AND cm.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "Owner or admin can manage members" ON public.company_members
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_members.company_id AND owner_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR user_id = auth.uid()
  );
CREATE POLICY "Owner or admin can update members" ON public.company_members
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_members.company_id AND owner_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "Owner or admin can delete members" ON public.company_members
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_members.company_id AND owner_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Audit log: members can read their company's logs, admins can read all
CREATE POLICY "Members can read own company audit" ON public.company_audit_log
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.company_members WHERE company_id = company_audit_log.company_id AND user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );
CREATE POLICY "Authenticated can insert audit log" ON public.company_audit_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Add update triggers
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_company_members_updated_at BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default plans
INSERT INTO public.plans (name, slug, price, max_users, max_products, features) VALUES
  ('Grátis', 'free', 0, 1, 50, '["Dashboard","Produtos (até 50)","PDV básico"]'::jsonb),
  ('Básico', 'basic', 99.90, 5, 500, '["Dashboard","Produtos (até 500)","PDV","CRM","Entrada XML","Conferência","Estoque"]'::jsonb),
  ('Premium', 'premium', 249.90, 20, 99999, '["Tudo do Básico","Produtos ilimitados","Integração ML","Envio FULL","Painel HUB","IA Tributária","Financeiro","Usuários ilimitados"]'::jsonb);
