-- Add admin_master to company_role enum
ALTER TYPE public.company_role ADD VALUE IF NOT EXISTS 'admin_master';