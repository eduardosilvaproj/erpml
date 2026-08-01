-- Fix Bug 1: features do plano enterprise é {} em vez de []
-- Alterar o default de features de '{}'::jsonb para '[]'::jsonb
-- e atualizar registros existentes que têm {} para []

-- 1. Atualizar registros existentes que têm {} (objeto vazio) para [] (array vazio)
UPDATE public.plans
SET features = '[]'::jsonb
WHERE features = '{}'::jsonb;

-- 2. Alterar o default da coluna features para '[]'::jsonb
ALTER TABLE public.plans
ALTER COLUMN features SET DEFAULT '[]'::jsonb;

-- 3. Verificar se a correção foi aplicada
-- SELECT id, name, features FROM public.plans WHERE name ILIKE '%enterprise%';