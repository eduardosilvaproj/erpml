import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type ProductResult = {
  name: string;
  description: string;
  avg_cost: number;
  suggested_price: number;
  margin_percent: number;
  category: string;
  demand_level: string;
  confidence: string;
};

export type SupplierResult = {
  name: string;
  type: string;
  location: string;
  contact_hint: string;
  min_order?: string;
  price_range?: string;
};

export type MarketInsights = {
  trend: string;
  seasonality?: string;
  competition: string;
  tip: string;
};

export type SearchResult = {
  products: ProductResult[];
  suppliers: SupplierResult[];
  market_insights: MarketInsights;
};

export type TrendingItem = {
  name: string;
  category: string;
  avg_cost: number;
  suggested_price: number;
  margin_percent: number;
  reason: string;
  demand_level: string;
};

export type SearchHistoryEntry = {
  query: string;
  timestamp: Date;
  resultCount: number;
};

export function useProductSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const { toast } = useToast();

  const search = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults(null);

    try {
      const { data, error } = await supabase.functions.invoke("product-search", {
        body: { action: "search", query: query.trim() },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");

      setSearchResults(data.data);
      setSearchHistory((prev) => [
        { query: query.trim(), timestamp: new Date(), resultCount: data.data.products?.length || 0 },
        ...prev.slice(0, 19),
      ]);
    } catch (err: any) {
      toast({ title: "Erro na pesquisa", description: err.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const fetchTrending = async (niche?: string) => {
    setIsTrendingLoading(true);
    setTrendingItems([]);

    try {
      const { data, error } = await supabase.functions.invoke("product-search", {
        body: { action: "trending", niche },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");

      setTrendingItems(data.data.items || []);
    } catch (err: any) {
      toast({ title: "Erro ao buscar tendências", description: err.message, variant: "destructive" });
    } finally {
      setIsTrendingLoading(false);
    }
  };

  return {
    search,
    isSearching,
    searchResults,
    fetchTrending,
    isTrendingLoading,
    trendingItems,
    searchHistory,
    setSearchHistory,
  };
}
