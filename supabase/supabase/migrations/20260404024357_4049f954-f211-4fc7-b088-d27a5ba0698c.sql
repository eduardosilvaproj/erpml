
-- ML Questions table to persist Mercado Livre questions
CREATE TABLE public.ml_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ml_question_id bigint NOT NULL,
  ml_item_id text NOT NULL,
  ml_item_title text,
  ml_from_id bigint,
  ml_from_nickname text,
  question_text text NOT NULL,
  answer_text text,
  question_date timestamp with time zone,
  answer_date timestamp with time zone,
  status text NOT NULL DEFAULT 'unanswered',
  ml_raw jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, ml_question_id)
);

ALTER TABLE public.ml_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own company ml_questions" ON public.ml_questions
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own company ml_questions" ON public.ml_questions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own company ml_questions" ON public.ml_questions
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete ml_questions" ON public.ml_questions
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
