
-- 1) Fix search_path on remaining functions
CREATE OR REPLACE FUNCTION public.calculate_kit_stock(p_kit_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_min_stock INTEGER := 999999;
  v_stock INTEGER := 0;
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT ki.quantity, p.stock_physical
    FROM kit_items ki
    JOIN products p ON p.id = ki.product_id
    WHERE ki.kit_id = p_kit_id
  LOOP
    IF v_item.stock_physical IS NULL OR v_item.stock_physical <= 0 THEN
      v_min_stock := 0;
      EXIT;
    END IF;
    v_stock := v_item.stock_physical / v_item.quantity;
    IF v_stock < v_min_stock THEN
      v_min_stock := v_stock;
    END IF;
  END LOOP;
  IF v_min_stock = 999999 THEN
    RETURN 0;
  END IF;
  RETURN v_min_stock;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_all_kits_stock(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_kit RECORD;
  v_new_stock INTEGER;
BEGIN
  FOR v_kit IN
    SELECT id FROM product_kits WHERE company_id = p_company_id
  LOOP
    v_new_stock := calculate_kit_stock(v_kit.id);
    UPDATE product_kits SET stock_physical = v_new_stock WHERE id = v_kit.id;
  END LOOP;
END;
$function$;

-- 2) Prevent privilege escalation via profiles.company_id self-assignment
CREATE OR REPLACE FUNCTION public.prevent_profile_company_id_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    -- Only allow when running as a privileged role (SECURITY DEFINER helpers run as postgres/table owner)
    -- or when the caller is a master admin. Regular 'authenticated' sessions cannot change company_id.
    IF current_user = 'authenticated' AND NOT public.is_admin_master() THEN
      RAISE EXCEPTION 'Alteração direta de company_id não é permitida'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_company_id_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_company_id_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_company_id_change();

-- Remove the misleading permissive policy explicitly named as if it allowed setting company_id
DROP POLICY IF EXISTS "Users can set their own company_id" ON public.profiles;

-- 3) Lock down realtime.messages broadcast policies (app does not use Broadcast/Presence)
DROP POLICY IF EXISTS "Authenticated users can receive realtime broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send realtime broadcasts" ON realtime.messages;
