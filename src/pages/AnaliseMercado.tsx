import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Loader2, Sparkles, ArrowLeft, Copy, Check,
  TrendingUp, Gem, Factory, DollarSign, Target
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

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

export default function AnaliseMercado() {
  const [niche, setNiche] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

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
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[70vh]">
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
