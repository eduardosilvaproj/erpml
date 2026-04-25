import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns the current user's company_id for multi-tenant data scoping.
 * All data hooks should use this to filter and insert with the correct company_id.
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
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  return profile?.company_id ?? null;
}
