
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can delete sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can delete sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can delete invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;

CREATE POLICY "Only admins can delete customers" ON public.customers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete suppliers" ON public.suppliers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete sales" ON public.sales
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete sale_items" ON public.sale_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete invoices" ON public.invoices
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete invoice_items" ON public.invoice_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete products" ON public.products
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
