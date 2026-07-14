import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2, Plus, X, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

export default function PrevisaoDemanda() {
  const [products, setProducts] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const addProduct = () => {
    const name = input.trim();
    if (!name || products.length >= 20) return;
    setProducts((prev) => [...prev, name]);
    setInput("");
  };

  const handleAnalyze = async () => {
    if (products.length === 0) return;
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-analysis", {
        body: { type: "demand", products },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      setResult(data.content);
    } catch (err: any) {
      toast.error(err.message || "Erro ao prever demanda");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ia-hub")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Previsão de Demanda</h1>
          <p className="text-muted-foreground text-sm">IA prevê tendências e demanda dos seus produtos</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar Produtos</CardTitle>
          <CardDescription>Adicione até 20 produtos para análise de demanda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nome do produto..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addProduct()}
              disabled={isLoading}
            />
            <Button variant="outline" onClick={addProduct} disabled={!input.trim() || products.length >= 20}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {products.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {products.map((p, i) => (
                <Badge key={i} variant="secondary" className="gap-1 pr-1">
                  {p}
                  <button onClick={() => setProducts((prev) => prev.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <Button onClick={handleAnalyze} disabled={isLoading || products.length === 0} className="w-full">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Analisar Demanda ({products.length} produto{products.length !== 1 ? "s" : ""})
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Previsão de Demanda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[60vh]">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
