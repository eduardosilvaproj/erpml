import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Type, Loader2, Sparkles, ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

export default function OtimizadorTitulos() {
  const [productName, setProductName] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [targetCategory, setTargetCategory] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleOptimize = async () => {
    if (!productName.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-analysis", {
        body: {
          type: "title_optimizer",
          productName: productName.trim(),
          currentTitle: currentTitle || undefined,
          targetCategory: targetCategory || undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      setResult(data.content);
    } catch (err: any) {
      toast.error(err.message || "Erro ao otimizar título");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success("Resultado copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ia-hub")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <Type className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Otimizador de Títulos</h1>
          <p className="text-muted-foreground text-sm">IA cria títulos otimizados para SEO no Mercado Livre</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações do Produto</CardTitle>
          <CardDescription>Informe o produto para gerar títulos otimizados com palavras-chave relevantes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Produto *</Label>
            <Input placeholder="Ex: Fone de ouvido Bluetooth com cancelamento de ruído" value={productName} onChange={(e) => setProductName(e.target.value)} disabled={isLoading} />
          </div>
          <div>
            <Label>Título Atual (opcional)</Label>
            <Input placeholder="Cole seu título atual para análise" value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} disabled={isLoading} />
          </div>
          <div>
            <Label>Categoria (opcional)</Label>
            <Input placeholder="Ex: Eletrônicos, Celulares, Informática..." value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)} disabled={isLoading} />
          </div>
          <Button onClick={handleOptimize} disabled={isLoading || !productName.trim()} className="w-full">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Otimizar Título
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Type className="h-4 w-4" /> Títulos Otimizados
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
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
