import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Loader2, Sparkles, ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";

export default function RespostaPerguntas() {
  const [question, setQuestion] = useState("");
  const [productContext, setProductContext] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (!question.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-analysis", {
        body: {
          type: "question_answer",
          question: question.trim(),
          productContext: productContext || undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      setResult(data.content);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar resposta");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success("Resposta copiada!");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ia-hub")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <HelpCircle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Resposta de Perguntas</h1>
          <p className="text-muted-foreground text-sm">IA gera respostas profissionais para perguntas de compradores</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pergunta do Comprador</CardTitle>
          <CardDescription>Cole a pergunta recebida e o contexto do produto para gerar opções de resposta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Pergunta *</Label>
            <Textarea
              placeholder="Ex: Esse produto é original? Quanto tempo dura a bateria?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>
          <div>
            <Label>Contexto do Produto (opcional)</Label>
            <Input
              placeholder="Ex: Fone JBL Tune 510BT, bateria 40h, Bluetooth 5.0, original com NF"
              value={productContext}
              onChange={(e) => setProductContext(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button onClick={handleGenerate} disabled={isLoading || !question.trim()} className="w-full">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Gerar Respostas
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-4 w-4" /> Opções de Resposta
              </CardTitle>
              <Badge variant="secondary" className="text-xs">Clique para copiar qualquer opção</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[60vh]">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleCopy(result, 0)}>
                  {copiedIdx === 0 ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  {copiedIdx === 0 ? "Copiado" : "Copiar tudo"}
                </Button>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
