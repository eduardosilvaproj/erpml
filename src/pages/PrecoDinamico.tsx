import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

export default function PrecoDinamico() {
  const [productName, setProductName] = useState("");
  const [cost, setCost] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [category, setCategory] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleAnalyze = async () => {
    if (!productName.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-analysis", {
        body: {
          type: "pricing",
          productName: productName.trim(),
          cost: cost ? parseFloat(cost) : undefined,
          currentPrice: currentPrice ? parseFloat(currentPrice) : undefined,
          category: category || undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      setResult(data.content);
    } catch (err: any) {
      toast.error(err.message || "Erro ao calcular preço");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ia-hub")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <DollarSign className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Preço Dinâmico</h1>
          <p className="text-muted-foreground text-sm">IA sugere preços otimizados para maximizar seu lucro</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do Produto</CardTitle>
          <CardDescription>Preencha as informações para receber sugestões de preço inteligentes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome do Produto *</Label>
            <Input placeholder="Ex: Fone Bluetooth JBL Tune 510BT" value={productName} onChange={(e) => setProductName(e.target.value)} disabled={isLoading} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Custo (R$)</Label>
              <Input type="number" placeholder="0,00" value={cost} onChange={(e) => setCost(e.target.value)} disabled={isLoading} />
            </div>
            <div>
              <Label>Preço Atual (R$)</Label>
              <Input type="number" placeholder="0,00" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} disabled={isLoading} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input placeholder="Ex: Eletrônicos" value={category} onChange={(e) => setCategory(e.target.value)} disabled={isLoading} />
            </div>
          </div>
          <Button onClick={handleAnalyze} disabled={isLoading || !productName.trim()} className="w-full">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Calcular Preço Inteligente
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Sugestão de Preço
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
