
-- Campaign templates table
CREATE TABLE public.campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description_prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company templates" ON public.campaign_templates
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company templates" ON public.campaign_templates
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company templates" ON public.campaign_templates
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own company templates" ON public.campaign_templates
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  template_id uuid REFERENCES public.campaign_templates(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  published_at timestamptz,
  total_items integer NOT NULL DEFAULT 0,
  items_processed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company campaigns" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company campaigns" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own company campaigns" ON public.campaigns
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Campaign items table
CREATE TABLE public.campaign_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  product_name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  original_description text,
  ai_description text,
  ai_category text,
  ai_tags text[],
  ai_specs jsonb DEFAULT '{}',
  image_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pendente',
  ai_cost_tokens integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company campaign_items" ON public.campaign_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_items.campaign_id
    AND (campaigns.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can insert own company campaign_items" ON public.campaign_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_items.campaign_id
    AND (campaigns.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can update own company campaign_items" ON public.campaign_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_items.campaign_id
    AND (campaigns.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can delete own company campaign_items" ON public.campaign_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_items.campaign_id
    AND (campaigns.company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));
