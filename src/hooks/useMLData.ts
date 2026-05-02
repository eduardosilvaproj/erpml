import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

/**
 * Interface for Mercado Livre connection status.
 */
export interface MLConnectionStatus {
  has_refresh_token: boolean;
  is_active: boolean;
  ml_user_id: string;
  needs_reauth: boolean;
  seller_nickname: string | null;
  token_expires_at: string;
  updated_at?: string;
}

/**
 * Result of the catalog synchronization process.
 */
export interface SyncCatalogResult {
  linked_products: number;
  matched_products: number;
  removed_links: number;
  total_items: number;
  unmatched_items: number;
}

/**
 * Result of order synchronization.
 */
export interface SyncOrdersResult {
  total_fetched: number;
  inserted: number;
  updated: number;
  total_in_ml: number;
}

/**
 * Type for Mercado Livre Questions from the database.
 */
export type MLQuestion = Database["public"]["Tables"]["ml_questions"]["Row"];

/**
 * Result of a Mercado Livre API function call error context.
 */
interface FunctionErrorContext {
  json: () => Promise<{ error: string }>;
}

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

export function useDisconnectML() {
  const { callML } = useMLApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return callML<{ success: boolean; message: string }>("disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-connection"] });
      queryClient.invalidateQueries({ queryKey: ["ml-items"] });
      queryClient.invalidateQueries({ queryKey: ["ml-orders"] });
      queryClient.invalidateQueries({ queryKey: ["ml-linked-products"] });
      queryClient.invalidateQueries({ queryKey: ["ml-persisted-orders"] });
      queryClient.invalidateQueries({ queryKey: ["ml-webhook-status"] });
      queryClient.invalidateQueries({ queryKey: ["ml-questions"] });
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

export function usePersistedMLOrders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ml-persisted-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ml_orders")
        .select("*, ml_order_items(*, products(id, name, sku))")
        .order("date_created", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export function useSyncMLOrders() {
  const { callML } = useMLApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return callML<{
        total_fetched: number;
        inserted: number;
        updated: number;
        total_in_ml: number;
      }>("sync-orders", { limit: 200 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-persisted-orders"] });
      queryClient.invalidateQueries({ queryKey: ["ml-orders"] });
      queryClient.invalidateQueries({ queryKey: ["ml-connection"] });
    },
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

export function useSyncPrice() {
  const { callML } = useMLApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      price,
    }: {
      itemId: string;
      price: number;
    }) => {
      return callML("sync-price", { itemId, price });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-linked-products"] });
      queryClient.invalidateQueries({ queryKey: ["ml-items"] });
    },
  });
}

export function useSyncAllToML() {
  const { callML } = useMLApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return callML<{
        synced: number;
        errors: number;
        total: number;
      }>("sync-all-to-ml");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-linked-products"] });
      queryClient.invalidateQueries({ queryKey: ["ml-items"] });
      queryClient.invalidateQueries({ queryKey: ["ml-connection"] });
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

export function useMLWebhookStatus(enabled: boolean) {
  const { callML } = useMLApi();

  return useQuery({
    queryKey: ["ml-webhook-status"],
    enabled,
    queryFn: () => callML("webhook-status"),
    retry: false,
  });
}

export function useRegisterMLWebhook() {
  const { callML } = useMLApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return callML("register-webhook");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-webhook-status"] });
    },
  });
}

export function useUnregisterMLWebhook() {
  const { callML } = useMLApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (webhookId: string) => {
      return callML("unregister-webhook", { webhookId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-webhook-status"] });
    },
  });
}

export function useMLQuestions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ml-questions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ml_questions")
        .select("*")
        .order("question_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export function useSyncMLQuestions() {
  const { callML } = useMLApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return callML<{
        total_fetched: number;
        inserted: number;
        updated: number;
        total_in_ml: number;
      }>("sync-questions", { limit: 200 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-questions"] });
      queryClient.invalidateQueries({ queryKey: ["ml-connection"] });
    },
  });
}

export function useAnswerMLQuestion() {
  const { callML } = useMLApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, text }: { questionId: number; text: string }) => {
      return callML("answer-question", { questionId, text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ml-questions"] });
    },
  });
}

export function useSuggestMLAnswer() {
  const { callML } = useMLApi();

  return useMutation({
    mutationFn: async ({ questionText, itemTitle, itemId }: { questionText: string; itemTitle?: string; itemId?: string }) => {
      return callML<{ suggestion: string }>("suggest-answer", { questionText, itemTitle, itemId });
    },
  });
}