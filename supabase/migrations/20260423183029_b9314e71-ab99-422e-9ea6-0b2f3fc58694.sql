-- Remover a constraint única do número do frete na tabela ordens_full
ALTER TABLE ordens_full DROP CONSTRAINT IF EXISTS ordens_full_numero_key;

-- Remover a constraint única de frete_ml em full_orders se existir
ALTER TABLE full_orders DROP CONSTRAINT IF EXISTS full_orders_frete_ml_key;

-- Criar índices simples para performance nas buscas por frete
CREATE INDEX IF NOT EXISTS idx_ordens_full_numero ON ordens_full(numero);
CREATE INDEX IF NOT EXISTS idx_full_orders_frete_ml ON full_orders(frete_ml);
