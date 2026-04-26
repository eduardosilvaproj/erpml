import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useAuth } from "@/contexts/AuthContext";

export type WatchlistItem = {
  id: string;
  user_id: string;
  company_id: string | null;
  product_name: string;
  category: string | null;
  avg_cost: number;
  suggested_price: number;
  margin_percent: number;
  demand_level: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function useWatchlist() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["product_watchlist", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_watchlist")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WatchlistItem[];
    },
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (item: {
      product_name: string;
      category?: string;
      avg_cost?: number;
      suggested_price?: number;
      margin_percent?: number;
      demand_level?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("product_watchlist")
        .insert({
          user_id: user?.id,
          company_id: companyId,
          product_name: item.product_name,
          category: item.category || null,
          avg_cost: item.avg_cost ?? 0,
          suggested_price: item.suggested_price ?? 0,
          margin_percent: item.margin_percent ?? 0,
          demand_level: item.demand_level || null,
          notes: item.notes || null,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_watchlist"] });
      toast({ title: "Produto adicionado à watchlist!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    },
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_watchlist")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_watchlist"] });
      toast({ title: "Produto removido da watchlist!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    },
  });
}
