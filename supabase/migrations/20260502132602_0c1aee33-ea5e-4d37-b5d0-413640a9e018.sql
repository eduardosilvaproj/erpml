-- Índices para otimização de performance
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_company_id ON public.sales(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_stock_movement_logs_product_id ON public.stock_movement_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_orders_company_id ON public.ml_orders(company_id);
