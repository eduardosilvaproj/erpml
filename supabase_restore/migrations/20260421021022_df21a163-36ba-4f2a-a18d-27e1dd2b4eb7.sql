CREATE OR REPLACE FUNCTION public.get_conference_totals(conf_id uuid)
RETURNS TABLE(total_bips numeric, unique_products bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(ci.scanned_quantity), 0)::numeric AS total_bips,
    COUNT(DISTINCT ci.product_id)::bigint AS unique_products
  FROM public.conference_items ci
  JOIN public.conferences c ON c.id = ci.conference_id
  WHERE ci.conference_id = conf_id
    AND (
      c.company_id = get_user_company_id(auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_conference_items_grouped(conf_id uuid)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  sku text,
  ean text,
  total_qty numeric,
  expected_qty numeric,
  last_scan timestamptz,
  detalhes_caixa jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ci.product_id,
    MAX(COALESCE(p.name, ci.nome_produto)) AS product_name,
    MAX(COALESCE(p.sku, ci.sku)) AS sku,
    MAX(COALESCE(p.barcode, ci.ean)) AS ean,
    COALESCE(SUM(ci.scanned_quantity), 0)::numeric AS total_qty,
    COALESCE(MAX(ci.expected_quantity), 0)::numeric AS expected_qty,
    MAX(COALESCE(ci.updated_at, ci.created_at)) AS last_scan,
    (ARRAY_AGG(ci.detalhes_caixa ORDER BY ci.updated_at DESC NULLS LAST))[1] AS detalhes_caixa
  FROM public.conference_items ci
  JOIN public.conferences c ON c.id = ci.conference_id
  LEFT JOIN public.products p ON p.id = ci.product_id
  WHERE ci.conference_id = conf_id
    AND (
      c.company_id = get_user_company_id(auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  GROUP BY ci.product_id
  ORDER BY MAX(COALESCE(ci.updated_at, ci.created_at)) DESC;
$$;