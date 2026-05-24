CREATE OR REPLACE FUNCTION public.get_conference_distinct_product_count(_conference_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT ci.product_id)
  FROM public.conference_items ci
  JOIN public.conferences c ON c.id = ci.conference_id
  WHERE ci.conference_id = _conference_id
    AND ci.product_id IS NOT NULL
    AND (
      c.company_id = get_user_company_id(auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
    );
$$;