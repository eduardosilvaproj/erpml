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

/** Mapeia um produto do banco local para o formato ProductResult */
function mapProductToResult(product: any, categoryName?: string): ProductResult {
  const cost = product.cost ?? 0;
  const price = product.price ?? 0;
  const margin = price > 0 ? ((price - cost) / price) * 100 : 0;

  return {
    name: product.name || "Sem nome",
    description: product.description || "",
    avg_cost: cost,
    suggested_price: price,
    margin_percent: Math.round(margin * 100) / 100,
    category: categoryName || "Sem categoria",
    demand_level: "Média",
    confidence: "Média",
  };
}

/** Busca local na tabela products por nome, SKU ou EAN */
async function searchLocalProducts(query: string): Promise<SearchResult> {
  const searchTerm = `%${query.trim()}%`;

  const { data: products, error } = await supabase
    .from("products")
    .select("*, categories(name)")
    .or(`name.ilike.${searchTerm},sku.ilike.${searchTerm},ean.ilike.${searchTerm}`)
    .eq("active", true)
    .limit(20);

  if (error) throw error;

  const mappedProducts: ProductResult[] = (products || []).map((p) =>
    mapProductToResult(p, (p as any).categories?.name)
  );

  return {
    products: mappedProducts,
    suppliers: [],
    market_insights: {
      trend: "Dados locais (sem análise de IA)",
      competition: "Não disponível",
      tip: "Esta busca utilizou dados do seu catálogo local. Para análises mais profundas, verifique a conexão com o serviço de IA.",
    },
  };
}

/** Busca produtos em alta localmente: mais vendidos ou com maior margem */
async function searchLocalTrending(niche?: string): Promise<TrendingItem[]> {
  let query = supabase
    .from("products")
    .select("*, categories(name)")
    .eq("active", true)
    .order("price", { ascending: false })
    .limit(20);

  if (niche?.trim()) {
    const nicheTerm = `%${niche.trim()}%`;
    query = query.or(`name.ilike.${nicheTerm},description.ilike.${nicheTerm}`);
  }

  const { data: products, error } = await query;
  if (error) throw error;

  return (products || []).map((p) => {
    const cost = p.cost ?? 0;
    const price = p.price ?? 0;
    const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
    const categoryName = (p as any).categories?.name || "Sem categoria";

    return {
      name: p.name || "Sem nome",
      category: categoryName,
      avg_cost: cost,
      suggested_price: price,
      margin_percent: Math.round(margin * 100) / 100,
      reason: "Produto do seu catálogo com boa margem",
      demand_level: "Média",
    };
  });
}

export function useProductSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { toast } = useToast();

  const search = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults(null);
    setSearchError(null);
    setIsFallback(false);

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
      const errorMsg = err.message || "Erro desconhecido";
      console.warn("[PesquisaInteligente] Edge function falhou, tentando fallback local:", errorMsg);

      // Fallback: busca local no banco de dados
      try {
        const localResults = await searchLocalProducts(query);
        setSearchResults(localResults);
        setIsFallback(true);
        setSearchHistory((prev) => [
          { query: query.trim(), timestamp: new Date(), resultCount: localResults.products?.length || 0 },
          ...prev.slice(0, 19),
        ]);
        toast({
          title: "Busca local utilizada",
          description: "A pesquisa inteligente por IA não estava disponível. Exibindo resultados do seu catálogo.",
          variant: "default",
        });
      } catch (fallbackErr: any) {
        const fallbackMsg = fallbackErr.message || "Erro ao buscar localmente";
        setSearchError(`Não foi possível realizar a busca. ${errorMsg}. Fallback local: ${fallbackMsg}`);
        toast({
          title: "Erro na pesquisa",
          description: "A pesquisa inteligente e o fallback local falharam. Tente novamente mais tarde.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSearching(false);
    }
  };

  const fetchTrending = async (niche?: string) => {
    setIsTrendingLoading(true);
    setTrendingItems([]);
    setIsFallback(false);
    setSearchError(null);

    try {
      const { data, error } = await supabase.functions.invoke("product-search", {
        body: { action: "trending", niche },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");

      setTrendingItems(data.data.items || []);
    } catch (err: any) {
      const errorMsg = err.message || "Erro desconhecido";
      console.warn("[PesquisaInteligente] Edge function de tendências falhou, tentando fallback local:", errorMsg);

      // Fallback: busca local no banco de dados
      try {
        const localItems = await searchLocalTrending(niche);
        setTrendingItems(localItems);
        setIsFallback(true);
        toast({
          title: "Tendências locais",
          description: "As tendências por IA não estavam disponíveis. Exibindo produtos do seu catálogo com maior margem.",
          variant: "default",
        });
      } catch (fallbackErr: any) {
        const fallbackMsg = fallbackErr.message || "Erro ao buscar localmente";
        setSearchError(`Não foi possível buscar tendências. ${errorMsg}. Fallback local: ${fallbackMsg}`);
        toast({
          title: "Erro ao buscar tendências",
          description: "O serviço de IA e o fallback local falharam. Tente novamente mais tarde.",
          variant: "destructive",
        });
      }
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
    isFallback,
    searchError,
  };
}
