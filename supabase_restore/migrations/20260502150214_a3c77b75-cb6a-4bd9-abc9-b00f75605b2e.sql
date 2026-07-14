-- Índices de performance para otimização de consultas multi-tenant e buscas frequentes

-- Produtos
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_ean ON public.products(ean) WHERE ean IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active, company_id);

-- Vendas e Faturas (otimização de listagem por data)
CREATE INDEX IF NOT EXISTS idx_sales_company_date ON public.sales(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_company_date ON public.invoices(company_id, created_at DESC);

-- Itens e Relacionamentos (otimização de joins)
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON public.product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);