
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  due_date date,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  is_cash boolean NOT NULL DEFAULT false,
  paid_at timestamp with time zone,
  installment_number integer DEFAULT 1,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read invoice_payments"
  ON public.invoice_payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert invoice_payments"
  ON public.invoice_payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update invoice_payments"
  ON public.invoice_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Only admins can delete invoice_payments"
  ON public.invoice_payments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_invoice_payments_updated_at
  BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
