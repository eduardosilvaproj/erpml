import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PieChart, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

export default function AnaliseRentabilidade() {
  const [productName, setProductName] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [mlFees, setMlFees] = useState("");
  const [shippingCost, setShippingCost] = useState("");
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
          type: "profitability",
          productName: productName.trim(),
          cost: cost ? parseFloat(cost) : undefined,
          price: price ? parseFloat(price) : undefined,
          mlFees: mlFees ? parseFloat(mlFees) : undefined,
          shippingCost: shippingCost ? parseFloat(shippingCost) : undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      setResult(data.content);
    } catch (err: any) {
      toast.error(err.message || "Erro ao analisar rentabilidade");
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
          <PieChart className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Análise de Rentabilidade</h1>
          <p className="text-muted-foreground text-sm">IA calcula margem líquida, ROI e ponto de equilíbrio</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do Produto</CardTitle>
          <CardDescription>Preencha os valores para análise detalhada de rentabilidade</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome do Produto *</Label>
            <Input placeholder="Ex: Kit Ferramentas 120 peças" value={productName} onChange={(e) => setProductName(e.target.value)} disabled={isLoading} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <Label>Custo (R$)</Label>
              <Input type="number" placeholder="0,00" value={cost} onChange={(e) => setCost(e.target.value)} disabled={isLoading} />
            </div>
            <div>
              <Label>Preço Venda (R$)</Label>
              <Input type="number" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} disabled={isLoading} />
            </div>
            <div>
              <Label>Taxas ML (%)</Label>
              <Input type="number" placeholder="16" value={mlFees} onChange={(e) => setMlFees(e.target.value)} disabled={isLoading} />
            </div>
            <div>
              <Label>Frete (R$)</Label>
              <Input type="number" placeholder="0,00" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} disabled={isLoading} />
            </div>
          </div>
          <Button onClick={handleAnalyze} disabled={isLoading || !productName.trim()} className="w-full">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Analisar Rentabilidade
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" /> Resultado
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
