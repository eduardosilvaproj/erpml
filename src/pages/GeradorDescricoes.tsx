import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Loader2, Sparkles, ArrowLeft, Copy, Check, WifiOff, Eye } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

const TONE_LABELS: Record<string, string> = {
  profissional: "Profissional",
  casual: "Casual e amigável",
  tecnico: "Técnico e detalhado",
  urgente: "Urgente / Promoção",
  premium: "Premium / Luxo",
};

const TONE_TEMPLATES: Record<string, { intro: string; closer: string }> = {
  profissional: {
    intro: "é um produto de alta qualidade, ideal para quem busca o melhor em",
    closer: "Com design sofisticado e materiais premium, oferece desempenho superior e durabilidade excepcional para o dia a dia.",
  },
  casual: {
    intro: "é exatamente o que você precisa! Perfeito para quem busca",
    closer: "Fácil de usar, bonito e feito pra durar. Você vai amar!",
  },
  tecnico: {
    intro: "é uma solução técnica de alto padrão na categoria de",
    closer: "Especificações robustas, engenharia precisa e performance consistente garantem resultados confiáveis em qualquer cenário de uso.",
  },
  urgente: {
    intro: "é a oportunidade que você esperava! O melhor em",
    closer: "Oferta por tempo limitado! Aproveite agora e garanta o seu com condições especiais e entrega rápida.",
  },
  premium: {
    intro: "representa o ápice da excelência em",
    closer: "Uma experiência exclusiva para quem não abre mão do melhor. Cada detalhe foi pensado para superar expectativas.",
  },
};

function generateLocalDescription(productName: string, features: string, tone: string): string {
  const template = TONE_TEMPLATES[tone] || TONE_TEMPLATES.profissional;
  const category = productName.includes("TV") || productName.includes("Monitor")
    ? "entretenimento e imagem"
    : productName.includes("Fone") || productName.includes("Som") || productName.includes("Caixa")
    ? "áudio e som"
    : productName.includes("Celular") || productName.includes("Smartphone")
    ? "tecnologia móvel"
    : productName.includes("Notebook") || productName.includes("Computador")
    ? "computação e produtividade"
    : "tecnologia e inovação";

  const featuresSection = features
    ? `\n\n**Principais características:**\n${features.split(",").map((f) => `- ${f.trim()}`).join("\n")}`
    : "";

  return `**${productName}** ${template.intro} ${category}.${featuresSection}\n\n${template.closer}`;
}

function isDeployError(err: any): boolean {
  if (!err) return false;
  if (err instanceof TypeError && err.message === "Failed to fetch") return true;
  if (typeof err.message === "string") {
    const msg = err.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("econnrefused") || msg.includes("enotfound")) return true;
  }
  if (typeof err.code === "string" && ["ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "NETWORK_ERROR"].includes(err.code)) return true;
  if (typeof err.status === "number" && err.status >= 500) return true;
  if (err.status === 404) return true;
  return false;
}

export default function GeradorDescricoes() {
  const [productName, setProductName] = useState("");
  const [features, setFeatures] = useState("");
  const [tone, setTone] = useState("profissional");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const navigate = useNavigate();

  const livePreview = useMemo(() => {
    if (!productName.trim()) return null;
    return generateLocalDescription(productName.trim(), features, tone);
  }, [productName, features, tone]);

  const handleGenerate = async () => {
    if (!productName.trim()) return;
    setIsLoading(true);
    setResult(null);
    setIsOffline(false);
    try {
      const { data, error } = await supabase.functions.invoke("ai-analysis", {
        body: {
          type: "description",
          productName: productName.trim(),
          features: features || undefined,
          tone,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      setResult(data.content);
    } catch (err: any) {
      if (isDeployError(err)) {
        const fallback = generateLocalDescription(productName.trim(), features, tone);
        setResult(fallback);
        setIsOffline(true);
        toast.warning("Edge function indisponível — descrição gerada localmente (modo offline)");
      } else {
        toast.error(err.message || "Erro ao gerar descrição");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success("Descrição copiada!");
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
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Gerador de Descrições</h1>
          <p className="text-muted-foreground text-sm">IA cria descrições otimizadas para seus anúncios</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações do Produto</CardTitle>
          <CardDescription>Quanto mais detalhes, melhor será a descrição gerada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome do Produto *</Label>
            <Input placeholder="Ex: Smart TV Samsung 55 Crystal UHD 4K" value={productName} onChange={(e) => setProductName(e.target.value)} disabled={isLoading} />
          </div>
          <div>
            <Label>Características / Diferenciais</Label>
            <Textarea placeholder="Ex: Bluetooth 5.0, Bateria 40h, Dobrável, Cancelamento de ruído..." value={features} onChange={(e) => setFeatures(e.target.value)} disabled={isLoading} rows={3} />
          </div>
          <div>
            <Label>Tom da Descrição</Label>
            <Select value={tone} onValueChange={setTone} disabled={isLoading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="casual">Casual e amigável</SelectItem>
                <SelectItem value="tecnico">Técnico e detalhado</SelectItem>
                <SelectItem value="urgente">Urgente / Promoção</SelectItem>
                <SelectItem value="premium">Premium / Luxo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={isLoading || !productName.trim()} className="w-full">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Gerar Descrição
          </Button>
        </CardContent>
      </Card>

      {productName.trim() && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" /> Pré-visualização
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
                {showPreview ? "Ocultar" : "Mostrar"}
              </Button>
            </div>
          </CardHeader>
          {showPreview && (
            <CardContent>
              <ScrollArea className="max-h-[40vh]">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{livePreview}</ReactMarkdown>
                </div>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Descrição Gerada
                </CardTitle>
                {isOffline && (
                  <Badge variant="warning" className="gap-1">
                    <WifiOff className="h-3 w-3" /> Modo Offline
                  </Badge>
                )}
              </div>
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
