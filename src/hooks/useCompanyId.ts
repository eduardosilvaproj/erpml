import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook para obter o ID da empresa associada ao usuário autenticado.
 * Essencial para o isolamento de dados (multi-tenancy) no Supabase.
 * O ID é buscado no perfil do usuário e armazenado em cache pelo React Query.
 * 
 * @returns {string | null} O UUID da empresa ou null se não houver sessão ou vínculo.
 */
export function useCompanyId(): string | null {
  const { user } = useAuth();
  
  const { data: profile } = useQuery({
    queryKey: ["profile-company-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  return profile?.company_id ?? null;
}
