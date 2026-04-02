import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MLConnectionStatus = {
  has_refresh_token: boolean;
  is_active: boolean;
  ml_user_id: string;
  needs_reauth: boolean;
  seller_nickname: string | null;
  token_expires_at: string;
};

async function getFunctionErrorMessage(error: any) {
  const context = error?.context;
  if (context && typeof context.json === "function") {
    const payload = await context.json().catch(() => null);
    if (payload?.error) {
      return payload.error as string;
    }
  }

  return error?.message || "Erro ao comunicar com a integração.";
}

export function useMLConnection() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ml-connection", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ml-api", {
        body: { action: "connection-status" },
      });

      if (error) {
        throw new Error(await getFunctionErrorMessage(error));
      }

      return (data as MLConnectionStatus | null) ?? null;
    },
  });
}

export function useMLApi() {
  const callML = async <T = any>(action: string, params?: unknown): Promise<T> => {
    const { data, error } = await supabase.functions.invoke("ml-api", {
      body: { action, params },
    });

    if (error) {
      throw new Error(await getFunctionErrorMessage(error));
    }

    return data as T;
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
  const { callML } = useMLApi();

  return useQuery({
    queryKey: ["ml-linked-products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const fetchLinkedProducts = async () =>
        await supabase
          .from("ml_linked_products")
          .select("*, products(id, name, sku, stock_physical, stock_full, price)")
          .eq("user_id", user!.id);

      let { data, error } = await fetchLinkedProducts();
      if (error) throw error;

      if ((data?.length ?? 0) > 0) {
        return data;
      }

      const { data: connection, error: connectionError } = await supabase
        .from("ml_connections")
        .select("id, is_active")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();

      if (connectionError) {
        throw connectionError;
      }

      if (!connection) {
        return data;
      }

      try {
        await callML("sync-catalog");
        const refreshed = await fetchLinkedProducts();
        if (refreshed.error) throw refreshed.error;
        data = refreshed.data;
      } catch {
        return data;
      }

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

export function useSyncMLCatalog() {
  const { callML } = useMLApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return callML<{
        linked_products: number;
        matched_products: number;
        removed_links: number;
        total_items: number;
        unmatched_items: number;
      }>("sync-catalog");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-linked-products"] });
      queryClient.invalidateQueries({ queryKey: ["ml-items"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["ml-connection"] });
    },
  });
}

export function useMLAuthUrl() {
  const { user } = useAuth();
  const { callML } = useMLApi();

  return useQuery({
    queryKey: ["ml-auth-url", user?.id],
    enabled: !!user,
    queryFn: () => callML("get-auth-url"),
    staleTime: Infinity,
    retry: 1,
  });
}
