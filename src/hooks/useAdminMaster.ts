import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyCompany } from "./useCompanyData";

export function useIsAdminMaster() {
  const { user } = useAuth();
  const { data: company } = useMyCompany();

  return useQuery({
    queryKey: ["is-admin-master", user?.id, company?.id],
    enabled: !!user && !!company,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("company_members")
        .select("role")
        .eq("user_id", user!.id)
        .eq("company_id", company!.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error checking admin master role:", error);
        return false;
      }

      return data?.role === "admin_master";
    },
  });
}
