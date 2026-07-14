import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, Loader2, Sparkles, ArrowLeft, Copy, Check,
  TrendingUp, Gem, Factory, DollarSign, Target, Eye, Bookmark, BookmarkCheck, Trash2
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/hooks/useWatchlist";

const POPULAR_NICHES = [
  "Eletrônicos e Acessórios",
  "Casa e Decoração",
  "Moda e Vestuário",
  "Saúde e Beleza",
  "Pet Shop",
  "Informática e Games",
  "Bebê e Infantil",
  "Esporte e Lazer",
  "Automotivo",
  "Ferramentas",
];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function AnaliseMercado() {
  const [niche, setNiche] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("analyze");
  const navigate = useNavigate();

  const { data: watchlist = [], isLoading: watchlistLoading } = useWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const watchlistNames = new Set(watchlist.map((w) => w.product_name.toLowerCase()));

  const handleAnalyze = async () => {
    if (!niche.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-analysis", {
        body: {
          type: "market_analysis",
          niche: niche.trim(),
          goal: goal.trim() || undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      setResult(data.content);
    } catch (err: any) {
      toast.error(err.message || "Erro ao analisar mercado");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success("Análise copiada!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveToWatchlist = (productName: string) => {
    if (watchlistNames.has(productName.toLowerCase())) return;
    addToWatchlist.mutate({
      product_name: productName,
      category: niche,
      notes: `Encontrado na análise de mercado: ${niche}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ia-hub")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Análise de Mercado</h1>
          <p className="text-muted-foreground text-sm">
            Tendências, produtos em alta e fornecedores com contato direto
          </p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: TrendingUp, label: "Tendências", desc: "Produtos em alta" },
          { icon: Gem, label: "Oportunidades", desc: "Baixa concorrência" },
          { icon: Factory, label: "Fornecedores", desc: "Com contato direto" },
          { icon: DollarSign, label: "Financeiro", desc: "ROI e investimento" },
          { icon: Target, label: "Estratégia", desc: "Como começar" },
        ].map((item) => (
          <Card key={item.label} className="border-dashed">
            <CardContent className="py-3 px-3 flex items-center gap-2">
              <item.icon className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs: Analyze vs Watchlist */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="analyze" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" /> Analisar
          </TabsTrigger>
          <TabsTrigger value="watchlist" className="flex items-center gap-1.5">
            <Eye className="h-4 w-4" /> Watchlist
            {watchlist.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] text-xs">{watchlist.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* === ANALYZE TAB === */}
        <TabsContent value="analyze" className="space-y-6 mt-4">
          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Pesquisar Nicho de Mercado
              </CardTitle>
              <CardDescription>
                Informe o nicho ou categoria e receba uma análise completa com produtos, fornecedores e estratégia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nicho / Categoria *</Label>
                <Input
                  placeholder="Ex: Capinhas para celular, Organizadores de cozinha, Acessórios para pet..."
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAnalyze()}
                  disabled={isLoading}
                />
              </div>

              {/* Quick niches */}
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_NICHES.map((n) => (
                  <Badge
                    key={n}
                    variant={niche === n ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => setNiche(n)}
                  >
                    {n}
                  </Badge>
                ))}
              </div>

              <div>
                <Label>Objetivo Específico (opcional)</Label>
                <Textarea
                  placeholder="Ex: Quero encontrar produtos com margem acima de 40% e MOQ baixo para começar com R$2.000..."
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  disabled={isLoading}
                  rows={2}
                />
              </div>

              <Button onClick={handleAnalyze} disabled={isLoading || !niche.trim()} className="w-full" size="lg">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analisando mercado... (pode levar até 30s)
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analisar Mercado e Encontrar Fornecedores
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Result */}
          {result && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Análise Completa — {niche}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      {copied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick save prompt */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <Bookmark className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Salvar produto na Watchlist</p>
                        <p className="text-xs text-muted-foreground mb-2">
                          Adicione produtos encontrados para monitorar depois
                        </p>
                        <div className="flex gap-2">
                          <Input
                            id="quick-save-input"
                            placeholder="Nome do produto encontrado..."
                            className="h-8 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const input = e.currentTarget;
                                if (input.value.trim()) {
                                  handleSaveToWatchlist(input.value.trim());
                                  input.value = "";
                                }
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              const input = document.getElementById("quick-save-input") as HTMLInputElement;
                              if (input?.value.trim()) {
                                handleSaveToWatchlist(input.value.trim());
                                input.value = "";
                              }
                            }}
                          >
                            <Bookmark className="h-3 w-3 mr-1" />
                            Salvar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <ScrollArea className="max-h-[70vh]">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
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
                <div className="text-center py-10">
                  <Eye className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Nenhum produto na watchlist ainda.</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Faça uma análise de mercado e salve produtos interessantes!
                  </p>
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
                              <Badge variant="outline" className="mt-1 text-xs">{item.category}</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeFromWatchlist.mutate(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {(item.avg_cost > 0 || item.suggested_price > 0) && (
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-secondary/50 p-2">
                              <p className="text-xs text-muted-foreground">Custo</p>
                              <p className="text-sm font-semibold">{formatBRL(item.avg_cost)}</p>
                            </div>
                            <div className="rounded-lg bg-secondary/50 p-2">
                              <p className="text-xs text-muted-foreground">Venda</p>
                              <p className="text-sm font-semibold">{formatBRL(item.suggested_price)}</p>
                            </div>
                            <div className="rounded-lg bg-primary/10 p-2">
                              <p className="text-xs text-muted-foreground">Margem</p>
                              <p className="text-sm font-bold text-primary">{item.margin_percent.toFixed(0)}%</p>
                            </div>
                          </div>
                        )}
                        {item.demand_level && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <TrendingUp className="h-3 w-3" />
                            Demanda: {item.demand_level}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{item.notes}</p>
                        )}
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
