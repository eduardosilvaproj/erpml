import { useHasAdminAccess } from "./useAdminData";

/**
 * @deprecated Use useHasAdminAccess from useAdminData instead.
 * This hook is kept for backward compatibility but redirect to the unified logic.
 */
export function useIsAdminMaster() {
  const { isAdminMaster, isLoading } = useHasAdminAccess();
  
  return {
    data: isAdminMaster,
    isLoading
  };
}
