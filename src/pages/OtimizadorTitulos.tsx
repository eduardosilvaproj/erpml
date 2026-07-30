import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Type, Loader2, Sparkles, ArrowLeft, Copy, Check, WifiOff } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

// Stop words comuns em português para filtrar na extração de keywords
const STOP_WORDS = new Set([
  "de", "da", "do", "das", "dos", "com", "sem", "para", "por", "em", "no", "na",
  "nos", "nas", "um", "uma", "uns", "umas", "o", "a", "os", "as", "e", "que",
  "é", "não", "ao", "aos", "à", "às", "se", "mais", "mas", "como", "porque",
  "tem", "têm", "está", "estão", "muito", "pode", "ser", "seu", "sua", "seus",
  "suas", "meu", "minha", "meus", "minhas", "teu", "tua", "tuas", "nosso",
  "nossa", "nossos", "nossas", "já", "ainda", "bem", "mal", "sim", "vai",
  "foi", "era", "são", "entre", "até", "após", "sobre", "contra", "durante",
  "através", "dentro", "fora", "antes", "depois", "desde", "sob", "perante",
  "comprar", "vender", "novo", "nova", "melhor", "original", "promoção",
  "barato", "qualidade", "perfeito", "ideal", "perfeita",
]);

interface LocalResult {
  suggestedTitle: string;
  keywords: string[];
  analysis: string;
  offline: true;
}

/**
 * Extrai palavras-chave relevantes de um texto:
 * - Remove acentos
 * - Filtra stop words
 * - Remove termos com 2 caracteres ou menos
 * - Retorna únicas ordenadas por especificidade (maior length primeiro)
 */
function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const unique = [...new Set(words)];
  return unique.sort(
    (a, b) => b.length - a.length || words.indexOf(a) - words.indexOf(b)
  );
}

/**
 * Gera sugestão de título local quando a edge function de IA não está disponível.
 * Extrai keywords, monta título com contexto de categoria e garante tamanho adequado para ML.
 */
function generateLocalSuggestion(
  productName: string,
  currentTitle?: string,
  category?: string
): LocalResult {
  const keywords = extractKeywords(productName);
  const topKeywords = keywords.slice(0, 3);

  let suggestedTitle = productName;

  // Adiciona contexto da categoria se disponível
  if (category) {
    const catWords = extractKeywords(category);
    const extraWords = catWords.filter((w) => !keywords.includes(w)).slice(0, 2);
    if (extraWords.length > 0) {
      suggestedTitle = `${productName} - ${extraWords.join(" ")}`;
    }
  }

  // Adiciona keywords principais se não estiverem no nome original
  const nameLower = productName.toLowerCase();
  const missingKeywords = topKeywords.filter((k) => !nameLower.includes(k));
  if (missingKeywords.length > 0) {
    suggestedTitle += ` | ${missingKeywords.join(" ")}`;
  }

  // Garante tamanho mínimo (ML ideal: 50-80 caracteres)
  if (suggestedTitle.length < 40) {
    const extra = keywords.slice(3, 6);
    if (extra.length > 0) {
      suggestedTitle += ` ${extra.join(" ")}`;
    }
  }

  // Trunca se exceder limite
  if (suggestedTitle.length > 120) {
    suggestedTitle = suggestedTitle.substring(0, 117) + "...";
  }

  const analysis = [
    "## Título Sugerido (Fallback Local)",
    "",
    suggestedTitle,
    "",
    "---",
    "",
    "### Palavras-chave Extraídas",
    "",
    keywords.map((k) => `- \`${k}\``).join("\n"),
    "",
    "### Análise",
    "",
    `- **Palavras-chave identificadas:** ${keywords.length}`,
    `- **Tamanho do título:** ${suggestedTitle.length} caracteres`,
    currentTitle ? `- **Título atual:** "${currentTitle}"` : "",
    category ? `- **Categoria:** ${category}` : "",
    "",
    "> **Nota:** Este é um resultado gerado localmente porque o servidor de IA não está disponível.",
    "> Para melhores resultados, tente novamente mais tarde ou verifique sua conexão.",
  ]
    .filter(Boolean)
    .join("\n");

  return { suggestedTitle, keywords, analysis, offline: true };
}

export default function OtimizadorTitulos() {
  const [productName, setProductName] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [targetCategory, setTargetCategory] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [localData, setLocalData] = useState<LocalResult | null>(null);
  const navigate = useNavigate();

  // Extrai keywords do nome do produto em tempo real (client-side)
  const extractedKeywords = useMemo(() => {
    if (!productName.trim()) return [];
    return extractKeywords(productName);
  }, [productName]);

  const handleOptimize = async () => {
    if (!productName.trim()) return;
    setIsLoading(true);
    setResult(null);
    setIsOffline(false);
    setLocalData(null);

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
      // Fallback local quando a edge function falha
      const fallback = generateLocalSuggestion(
        productName.trim(),
        currentTitle || undefined,
        targetCategory || undefined
      );
      setLocalData(fallback);
      setResult(fallback.analysis);
      setIsOffline(true);
      toast.warning(
        "Servidor de IA indisponível — usando otimização local"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    // Copia o título sugerido (local) ou o resultado completo (IA)
    const textToCopy = localData?.suggestedTitle || result || "";
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Título copiado!");
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
          <p className="text-muted-foreground text-sm">
            IA cria títulos otimizados para SEO no Mercado Livre
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Informações do Produto
          </CardTitle>
          <CardDescription>
            Informe o produto para gerar títulos otimizados com palavras-chave
            relevantes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Produto *</Label>
            <Input
              placeholder="Ex: Fone de ouvido Bluetooth com cancelamento de ruído"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div>
            <Label>Título Atual (opcional)</Label>
            <Input
              placeholder="Cole seu título atual para análise"
              value={currentTitle}
              onChange={(e) => setCurrentTitle(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div>
            <Label>Categoria (opcional)</Label>
            <Input
              placeholder="Ex: Eletrônicos, Celulares, Informática..."
              value={targetCategory}
              onChange={(e) => setTargetCategory(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Keywords extraídas em tempo real do nome do produto */}
          {extractedKeywords.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Palavras-chave detectadas no nome do produto:
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {extractedKeywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleOptimize}
            disabled={isLoading || !productName.trim()}
            className="w-full"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Otimizar Título
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Type className="h-4 w-4" /> Títulos Otimizados
                </CardTitle>
                {isOffline && (
                  <Badge
                    variant="outline"
                    className="text-amber-500 border-amber-500 gap-1"
                  >
                    <WifiOff className="h-3 w-3" /> Modo Offline
                  </Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Comparação lado a lado: título atual vs sugerido (apenas fallback local) */}
            {localData && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-muted">
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
                        Título Atual
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-sm">
                        {currentTitle || productName}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="py-3">
                      <CardTitle className="text-xs text-primary uppercase tracking-wide">
                        Título Sugerido
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <p className="text-sm font-medium">
                        {localData.suggestedTitle}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Keywords utilizadas no fallback */}
                {localData.keywords.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">
                      Palavras-chave utilizadas:
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {localData.keywords.map((kw) => (
                        <Badge key={kw} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Análise completa em markdown (tanto IA quanto fallback) */}
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
