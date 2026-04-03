import { useMyCompany } from "@/hooks/useCompanyData";

/**
 * Returns the current user's company_id for multi-tenant data scoping.
 * All data hooks should use this to filter and insert with the correct company_id.
 */
export function useCompanyId(): string | null {
  const { data: company } = useMyCompany();
  return company?.id ?? null;
}
