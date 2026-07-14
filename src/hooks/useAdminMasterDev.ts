import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AdminRole = 'admin_master_dev' | 'admin_master' | 'admin' | 'user';

export function useAdminMasterDev() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-admin-master-dev", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("role, is_active")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error checking admin master dev role:", error);
        return false;
      }

      return data?.role === "admin_master_dev";
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
