import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useMLConnection() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ml-connection", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ml_connections")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMLApi() {
  const { session } = useAuth();

  const callML = async (action: string, params?: any) => {
    const { data, error } = await supabase.functions.invoke("ml-api", {
      body: { action, params },
    });
    if (error) throw error;
    return data;
  };

  return { callML };
}

export function useMLItems(enabled: boolean) {
  const { callML } = useMLApi();

  return useQuery({
    queryKey: ["ml-items"],
    enabled,
    queryFn: () => callML("get-items", { limit: 50, offset: 0 }),
    retry: false,
  });
}

export function useMLOrders(enabled: boolean) {
  const { callML } = useMLApi();

  return useQuery({
    queryKey: ["ml-orders"],
    enabled,
    queryFn: () => callML("get-orders", { limit: 20, offset: 0 }),
    retry: false,
  });
}

export function useMLLinkedProducts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ml-linked-products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ml_linked_products")
        .select("*, products(id, name, sku, stock_physical, stock_full, price)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });
}

export function useSyncStock() {
  const { callML } = useMLApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      quantity,
    }: {
      itemId: string;
      quantity: number;
    }) => {
      return callML("sync-stock", { itemId, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-linked-products"] });
      queryClient.invalidateQueries({ queryKey: ["ml-items"] });
    },
  });
}

export function useMLAuthUrl() {
  const { callML } = useMLApi();

  return useQuery({
    queryKey: ["ml-auth-url"],
    queryFn: () => callML("get-auth-url"),
    staleTime: Infinity,
  });
}
