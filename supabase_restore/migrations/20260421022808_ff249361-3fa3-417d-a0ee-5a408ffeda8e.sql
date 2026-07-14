-- One-time cleanup: collapse all duplicate conference_items rows globally.
-- For each (conference_id, product_id) keep the row with the largest scanned_quantity
-- (the real count, since duplicates were created by re-saving the cumulative total).
WITH ranked AS (
  SELECT
    ci.id,
    ci.conference_id,
    ci.product_id,
    ci.sku,
    ci.ean,
    ci.nome_produto,
    ROW_NUMBER() OVER (
      PARTITION BY ci.conference_id,
        COALESCE(ci.product_id::text,
                 'sku:' || COALESCE(ci.sku, ''),
                 'ean:' || COALESCE(ci.ean, ''),
                 'name:' || COALESCE(ci.nome_produto, ''))
      ORDER BY ci.scanned_quantity DESC, ci.updated_at DESC
    ) AS rn,
    MAX(ci.scanned_quantity) OVER (
      PARTITION BY ci.conference_id,
        COALESCE(ci.product_id::text,
                 'sku:' || COALESCE(ci.sku, ''),
                 'ean:' || COALESCE(ci.ean, ''),
                 'name:' || COALESCE(ci.nome_produto, ''))
    ) AS true_qty,
    MAX(ci.expected_quantity) OVER (
      PARTITION BY ci.conference_id,
        COALESCE(ci.product_id::text,
                 'sku:' || COALESCE(ci.sku, ''),
                 'ean:' || COALESCE(ci.ean, ''),
                 'name:' || COALESCE(ci.nome_produto, ''))
    ) AS true_expected
  FROM public.conference_items ci
)
DELETE FROM public.conference_items
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Re-normalize the surviving rows to the maximum value (idempotent).
WITH ranked AS (
  SELECT
    ci.id,
    MAX(ci.scanned_quantity) OVER (PARTITION BY ci.conference_id, ci.product_id) AS true_qty,
    MAX(ci.expected_quantity) OVER (PARTITION BY ci.conference_id, ci.product_id) AS true_expected
  FROM public.conference_items ci
  WHERE ci.product_id IS NOT NULL
)
UPDATE public.conference_items ci
SET scanned_quantity = r.true_qty,
    expected_quantity = r.true_expected,
    status = CASE
      WHEN r.true_expected <= 0 AND r.true_qty > 0 THEN 'ok'
      WHEN r.true_qty = r.true_expected THEN 'ok'
      WHEN r.true_qty > r.true_expected THEN 'excedente'
      ELSE 'pendente'
    END
FROM ranked r
WHERE ci.id = r.id;

-- Now create the unique index to prevent future duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS conference_items_unique_product_per_conference
ON public.conference_items (conference_id, product_id)
WHERE product_id IS NOT NULL;

-- Reusable maintenance function (members or admins can re-run if needed).
CREATE OR REPLACE FUNCTION public.dedupe_conference_items(conf_id uuid)
RETURNS TABLE(removed_rows bigint, kept_rows bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _removed bigint := 0;
  _kept bigint := 0;
BEGIN
  SELECT company_id INTO _company_id FROM public.conferences WHERE id = conf_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Conferência não encontrada';
  END IF;

  IF NOT (
    is_company_member(auth.uid(), _company_id)
    OR has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para consolidar esta conferência';
  END IF;

  WITH ranked AS (
    SELECT
      ci.id,
      ROW_NUMBER() OVER (
        PARTITION BY ci.conference_id,
          COALESCE(ci.product_id::text,
                   'sku:' || COALESCE(ci.sku, ''),
                   'ean:' || COALESCE(ci.ean, ''),
                   'name:' || COALESCE(ci.nome_produto, ''))
        ORDER BY ci.scanned_quantity DESC, ci.updated_at DESC
      ) AS rn,
      MAX(ci.scanned_quantity) OVER (
        PARTITION BY ci.conference_id,
          COALESCE(ci.product_id::text,
                   'sku:' || COALESCE(ci.sku, ''),
                   'ean:' || COALESCE(ci.ean, ''),
                   'name:' || COALESCE(ci.nome_produto, ''))
      ) AS true_qty,
      MAX(ci.expected_quantity) OVER (
        PARTITION BY ci.conference_id,
          COALESCE(ci.product_id::text,
                   'sku:' || COALESCE(ci.sku, ''),
                   'ean:' || COALESCE(ci.ean, ''),
                   'name:' || COALESCE(ci.nome_produto, ''))
      ) AS true_expected
    FROM public.conference_items ci
    WHERE ci.conference_id = conf_id
  ),
  d AS (
    DELETE FROM public.conference_items
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    RETURNING 1
  ),
  u AS (
    UPDATE public.conference_items ci
    SET scanned_quantity = r.true_qty,
        expected_quantity = r.true_expected,
        status = CASE
          WHEN r.true_expected <= 0 AND r.true_qty > 0 THEN 'ok'
          WHEN r.true_qty = r.true_expected THEN 'ok'
          WHEN r.true_qty > r.true_expected THEN 'excedente'
          ELSE 'pendente'
        END
    FROM ranked r
    WHERE ci.id = r.id AND r.rn = 1
    RETURNING 1
  )
  SELECT (SELECT COUNT(*) FROM d), (SELECT COUNT(*) FROM u) INTO _removed, _kept;

  RETURN QUERY SELECT _removed, _kept;
END;
$$;