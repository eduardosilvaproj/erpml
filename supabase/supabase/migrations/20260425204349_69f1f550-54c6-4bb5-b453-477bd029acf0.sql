-- Garantir que as chaves estrangeiras tenham ON DELETE CASCADE
ALTER TABLE public.invoice_items 
DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey,
ADD CONSTRAINT invoice_items_invoice_id_fkey 
  FOREIGN KEY (invoice_id) 
  REFERENCES invoices(id) 
  ON DELETE CASCADE;

ALTER TABLE public.conferences 
DROP CONSTRAINT IF EXISTS conferences_invoice_id_fkey,
ADD CONSTRAINT conferences_invoice_id_fkey 
  FOREIGN KEY (invoice_id) 
  REFERENCES invoices(id) 
  ON DELETE CASCADE;

ALTER TABLE public.invoice_payments 
DROP CONSTRAINT IF EXISTS invoice_payments_invoice_id_fkey,
ADD CONSTRAINT invoice_payments_invoice_id_fkey 
  FOREIGN KEY (invoice_id) 
  REFERENCES invoices(id) 
  ON DELETE CASCADE;

-- Adicionar índice de unicidade para evitar notas duplicadas por empresa
-- Isso ajudará a identificar exatamente onde ocorre o erro de chave duplicada
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_unique_import') THEN
        CREATE UNIQUE INDEX idx_invoices_unique_import ON public.invoices (number, series, issuer_cnpj, company_id);
    END IF;
END $$;

-- Ajustar políticas de RLS para permitir deleção se o usuário puder deletar a nota pai
DROP POLICY IF EXISTS "Only admins can delete invoice_items" ON public.invoice_items;
CREATE POLICY "Users can delete own company invoice_items" 
ON public.invoice_items 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND (invoices.company_id = get_auth_company_id() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

DROP POLICY IF EXISTS "Only admins can delete invoices" ON public.invoices;
CREATE POLICY "Users can delete own company invoices" 
ON public.invoices 
FOR DELETE 
USING (company_id = get_auth_company_id() OR has_role(auth.uid(), 'admin'::app_role));
