-- Allow owner_id to be NULL initially, as the Admin Master creation flow
-- creates the company first and then assigns an owner.
ALTER TABLE public.companies ALTER COLUMN owner_id DROP NOT NULL;

-- Re-verify the function logic (it already sets owner_id to NULL, which was failing)
-- No changes needed to the function body itself, just the table constraint.

-- Reload schema cache
NOTIFY pgrst, 'reload schema';