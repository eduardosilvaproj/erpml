import { useCompanyId } from "./useCompanyId";

/**
 * Retorna o companyId garantido como string.
 * Deve ser chamado apenas dentro de callbacks, handlers ou mutations.
 */
export function useCompanyIdRequired(): string {
  const companyId = useCompanyId();
  if (!companyId) {
    throw new Error("Empresa não encontrada — usuário sem company_id no perfil");
  }
  return companyId;
}
