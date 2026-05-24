import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Loader2, Sparkles, ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

export default function GeradorDescricoes() {
  const [productName, setProductName] = useState("");
  const [features, setFeatures] = useState("");
  const [tone, setTone] = useState("profissional");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (!productName.trim()) return;
    setIsLoading(true);
    setResult(null);
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
      toast.error(err.message || "Erro ao gerar descrição");
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

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Descrição Gerada
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
