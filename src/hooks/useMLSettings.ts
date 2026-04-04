import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MLSettings = {
  id: string;
  user_id: string;
  auto_sync_stock: boolean;
  auto_sync_price: boolean;
  auto_sync_orders: boolean;
  auto_suggest_answers: boolean;
};

const DEFAULTS: Omit<MLSettings, "id" | "user_id"> = {
  auto_sync_stock: true,
  auto_sync_price: true,
  auto_sync_orders: true,
  auto_suggest_answers: false,
};

export function useMLSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ml-settings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ml_settings" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as MLSettings;
      // Return defaults if no row yet
      return { ...DEFAULTS, id: "", user_id: user!.id } as MLSettings;
    },
  });
}

export function useUpdateMLSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<MLSettings, "id" | "user_id">>) => {
      // Upsert: try update first, insert if not exists
      const { data: existing } = await supabase
        .from("ml_settings" as any)
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("ml_settings" as any)
          .update({ ...updates, updated_at: new Date().toISOString() } as any)
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ml_settings" as any)
          .insert({ user_id: user!.id, ...DEFAULTS, ...updates } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-settings"] });
    },
  });
}
