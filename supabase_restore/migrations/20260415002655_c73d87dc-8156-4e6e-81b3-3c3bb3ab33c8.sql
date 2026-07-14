
-- Drop the overly permissive policy
DROP POLICY "Anyone can create store orders" ON public.store_orders;

-- Replace with a policy that only allows orders for active stores
CREATE POLICY "Anyone can create orders for active stores" ON public.store_orders
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM seller_stores WHERE id = store_orders.store_id AND is_active = true)
  );
