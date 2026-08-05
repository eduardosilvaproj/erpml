import { useState } from "react";
import {
  Search, TrendingUp, Package, Truck, BarChart3, Clock, Star, ArrowUpRight,
  Sparkles, MapPin, Phone, DollarSign, Lightbulb, Bookmark, BookmarkCheck, Trash2, Eye,
  WifiOff, Database
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProductSearch, type ProductResult, type SupplierResult, type TrendingItem } from "@/hooks/useProductSearch";
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/hooks/useWatchlist";

function demandColor(level: string) {
  const l = level?.toLowerCase();
  if (l === "alta") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (l === "média" || l === "media") return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

function confidenceColor(level: string) {
  const l = level?.toLowerCase();
  if (l === "alta") return "text-emerald-600 dark:text-emerald-400";
  if (l === "média" || l === "media") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function ProductCard({ product, onSave, isSaved }: { product: ProductResult; onSave: () => void; isSaved: boolean }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{product.name}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2">{product.description}</CardDescription>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={demandColor(product.demand_level)}>{product.demand_level}</Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onSave}
              title={isSaved ? "Já na watchlist" : "Salvar na watchlist"}
            >
              {isSaved ? (
                <BookmarkCheck className="h-4 w-4 text-primary" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-secondary/50 p-2">
            <p className="text-xs text-muted-foreground">Custo</p>
            <p className="text-sm font-semibold text-foreground">{formatBRL(product.avg_cost)}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-2">
            <p className="text-xs text-muted-foreground">Venda</p>
            <p className="text-sm font-semibold text-foreground">{formatBRL(product.suggested_price)}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <p className="text-xs text-muted-foreground">Margem</p>
            <p className="text-sm font-bold text-primary">{product.margin_percent.toFixed(0)}%</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Package className="h-3 w-3" />{product.category}</span>
          <span className={confidenceColor(product.confidence)}>Confiança: {product.confidence}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierCard({ supplier }: { supplier: SupplierResult }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{supplier.name}</CardTitle>
          <Badge variant="outline">{supplier.type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" /><span>{supplier.location}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" /><span>{supplier.contact_hint}</span>
        </div>
        {supplier.min_order && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-3.5 w-3.5 shrink-0" /><span>Mín: {supplier.min_order}</span>
          </div>
        )}
        {supplier.price_range && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5 shrink-0" /><span>{supplier.price_range}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendingCard({ item, onSave, isSaved }: { item: TrendingItem; onSave: () => void; isSaved: boolean }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{item.name}</CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className={demandColor(item.demand_level)}>
              <TrendingUp className="h-3 w-3 mr-1" />{item.demand_level}
            </Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSave}>
              {isSaved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <CardDescription>{item.reason}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-secondary/50 p-2">
            <p className="text-xs text-muted-foreground">Custo</p>
            <p className="text-sm font-semibold text-foreground">{formatBRL(item.avg_cost)}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-2">
            <p className="text-xs text-muted-foreground">Venda</p>
            <p className="text-sm font-semibold text-foreground">{formatBRL(item.suggested_price)}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <p className="text-xs text-muted-foreground">Margem</p>
            <p className="text-sm font-bold text-primary">{item.margin_percent.toFixed(0)}%</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground text-center">{item.category}</p>
      </CardContent>
    </Card>
  );
}

export default function PesquisaInteligente() {
  const [query, setQuery] = useState("");
  const [nicheInput, setNicheInput] = useState("");
  const [activeTab, setActiveTab] = useState("search");
  const {
    search, isSearching, searchResults,
    fetchTrending, isTrendingLoading, trendingItems,
    searchHistory, isFallback, searchError,
  } = useProductSearch();

  const { data: watchlist = [], isLoading: watchlistLoading } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const watchlistNames = new Set(watchlist.map((w) => w.product_name.toLowerCase()));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  const handleHistoryClick = (q: string) => {
    setQuery(q);
    search(q);
  };

  const handleSaveProduct = (product: { name: string; category?: string; avg_cost: number; suggested_price: number; margin_percent: number; demand_level?: string }) => {
    if (watchlistNames.has(product.name.toLowerCase())) return;
    addToWatchlist.mutate({
      product_name: product.name,
      category: product.category,
      avg_cost: product.avg_cost,
      suggested_price: product.suggested_price,
      margin_percent: product.margin_percent,
      demand_level: product.demand_level,
    });
  };

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Pesquisa Inteligente
        </h1>
        <p className="text-muted-foreground mt-1">Encontre produtos, fornecedores e oportunidades de mercado com IA</p>
      </div>

      {/* Top-level tabs: Search vs Watchlist */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="search" className="flex items-center gap-1.5">
            <Search className="h-4 w-4" /> Pesquisar
          </TabsTrigger>
          <TabsTrigger value="watchlist" className="flex items-center gap-1.5">
            <Eye className="h-4 w-4" /> Watchlist
            {watchlist.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] text-xs">{watchlist.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* === SEARCH TAB === */}
        <TabsContent value="search" className="space-y-6 mt-4">
          {/* Search Bar */}
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Busque por produto, nicho ou categoria... Ex: 'capinha iPhone 15'"
                    className="pl-10"
                    disabled={isSearching}
                  />
                </div>
                <Button type="submit" disabled={isSearching || !query.trim()}>
                  {isSearching ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Pesquisando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2"><Search className="h-4 w-4" />Pesquisar</span>
                  )}
                </Button>
              </form>
              {searchHistory.length > 0 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {searchHistory.slice(0, 5).map((entry, i) => (
                    <button
                      key={i}
                      onClick={() => handleHistoryClick(entry.query)}
                      className="text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-full px-3 py-1 transition-colors"
                    >
                      {entry.query}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fallback / Error indicators */}
          {searchError && (
            <Alert variant="destructive">
              <WifiOff className="h-4 w-4" />
              <AlertTitle>Erro de conexão</AlertTitle>
              <AlertDescription>{searchError}</AlertDescription>
            </Alert>
          )}

          {isFallback && !searchError && (
            <Alert>
              <Database className="h-4 w-4" />
              <AlertTitle>Modo offline</AlertTitle>
              <AlertDescription>
                A pesquisa inteligente por IA não estava disponível. Os resultados abaixo são do seu catálogo local.
              </AlertDescription>
            </Alert>
          )}

          {/* Search Results */}
          {searchResults && (
            <Tabs defaultValue="products" className="space-y-4">
              <TabsList>
                <TabsTrigger value="products" className="flex items-center gap-1.5">
                  <Package className="h-4 w-4" /> Produtos ({searchResults.products?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="suppliers" className="flex items-center gap-1.5">
                  <Truck className="h-4 w-4" /> Fornecedores ({searchResults.suppliers?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="insights" className="flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" /> Insights
                </TabsTrigger>
              </TabsList>

              <TabsContent value="products">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {searchResults.products?.map((p, i) => (
                    <ProductCard
                      key={i}
                      product={p}
                      isSaved={watchlistNames.has(p.name.toLowerCase())}
                      onSave={() => handleSaveProduct(p)}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="suppliers">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {searchResults.suppliers?.map((s, i) => <SupplierCard key={i} supplier={s} />)}
                </div>
              </TabsContent>

              <TabsContent value="insights">
                {searchResults.market_insights && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-primary" /> Análise de Mercado
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl bg-secondary/50 p-4">
                          <p className="text-xs text-muted-foreground mb-1">Tendência</p>
                          <p className="font-semibold text-foreground flex items-center gap-1">
                            <ArrowUpRight className="h-4 w-4 text-primary" />{searchResults.market_insights.trend}
                          </p>
                        </div>
                        <div className="rounded-xl bg-secondary/50 p-4">
                          <p className="text-xs text-muted-foreground mb-1">Concorrência</p>
                          <p className="font-semibold text-foreground">{searchResults.market_insights.competition}</p>
                        </div>
                        {searchResults.market_insights.seasonality && (
                          <div className="rounded-xl bg-secondary/50 p-4">
                            <p className="text-xs text-muted-foreground mb-1">Sazonalidade</p>
                            <p className="font-semibold text-foreground">{searchResults.market_insights.seasonality}</p>
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <p className="text-xs text-primary font-medium mb-1 flex items-center gap-1">
                          <Star className="h-3.5 w-3.5" /> Dica Estratégica
                        </p>
                        <p className="text-sm text-foreground">{searchResults.market_insights.tip}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Trending Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" /> Produtos em Alta
                  </CardTitle>
                  <CardDescription>Descubra o que está vendendo bem agora</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={nicheInput}
                    onChange={(e) => setNicheInput(e.target.value)}
                    placeholder="Filtrar por nicho..."
                    className="w-48"
                    disabled={isTrendingLoading}
                  />
                  <Button variant="outline" onClick={() => fetchTrending(nicheInput || undefined)} disabled={isTrendingLoading}>
                    {isTrendingLoading ? (
                      <span className="h-4 w-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Sugerir
                  </Button>
                </div>
              </div>
            </CardHeader>
            {trendingItems.length > 0 && (
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {trendingItems.map((item, i) => (
                    <TrendingCard
                      key={i}
                      item={item}
                      isSaved={watchlistNames.has(item.name.toLowerCase())}
                      onSave={() => handleSaveProduct(item)}
                    />
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* === WATCHLIST TAB === */}
        <TabsContent value="watchlist" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" /> Minha Watchlist
              </CardTitle>
              <CardDescription>
                Produtos que você está monitorando ({watchlist.length})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {watchlistLoading ? (
                <div className="flex justify-center py-8">
                  <span className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : watchlist.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum produto na watchlist</p>
                  <p className="text-sm mt-1">Pesquise produtos e clique no ícone de bookmark para salvá-los aqui.</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {watchlist.map((item) => (
                    <Card key={item.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base truncate">{item.product_name}</CardTitle>
                            {item.category && (
                              <CardDescription className="mt-1">{item.category}</CardDescription>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.demand_level && (
                              <Badge className={demandColor(item.demand_level)}>{item.demand_level}</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeFromWatchlist.mutate(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="rounded-lg bg-secondary/50 p-2">
                            <p className="text-xs text-muted-foreground">Custo</p>
                            <p className="text-sm font-semibold text-foreground">{formatBRL(item.avg_cost)}</p>
                          </div>
                          <div className="rounded-lg bg-secondary/50 p-2">
                            <p className="text-xs text-muted-foreground">Venda</p>
                            <p className="text-sm font-semibold text-foreground">{formatBRL(item.suggested_price)}</p>
                          </div>
                          <div className="rounded-lg bg-primary/10 p-2">
                            <p className="text-xs text-muted-foreground">Margem</p>
                            <p className="text-sm font-bold text-primary">{item.margin_percent.toFixed(0)}%</p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground text-center">
                          Adicionado em {new Date(item.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
