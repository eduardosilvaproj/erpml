-- 1. Primeiro atualizamos os dados para ficarem compatíveis com a constraint
UPDATE public.invoice_items 
SET match_type = 'new' 
WHERE match_type = 'auto_created';

UPDATE public.invoice_items 
SET match_type = 'fuzzy' 
WHERE match_type = 'retro_match';

-- Garantir que se o product_id for nulo, o match_type seja 'none'
UPDATE public.invoice_items 
SET match_type = 'none' 
WHERE product_id IS NULL;

-- Se o match_type for 'none', o product_id deve ser nulo (opcional, dependendo da regra de negócio, mas o usuário pediu)
-- UPDATE public.invoice_items SET product_id = NULL WHERE match_type = 'none';

-- Limpar valores inválidos que porventura tenham passado (caso a constraint tenha sido desativada ou alterada)
UPDATE public.invoice_items 
SET match_type = 'none' 
WHERE match_type NOT IN ('exact', 'fuzzy', 'manual', 'new', 'none');

-- 2. Garantir que a constraint está correta (ela já existe, mas vamos reforçar se necessário ou apenas confiar nela)
-- A constraint atual já é: CHECK (match_type = ANY (ARRAY['exact'::text, 'fuzzy'::text, 'manual'::text, 'new'::text, 'none'::text]))
-- Não precisamos alterar a estrutura da tabela se a constraint já está lá, mas o código precisa ser corrigido.
