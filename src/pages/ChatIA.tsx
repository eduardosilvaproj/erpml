import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, Loader2, ArrowLeft, Bot, User, Sparkles, Trash2, FileText, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ReportPDF } from "@/components/ReportPDF";
import type { PeriodFilter } from "@/hooks/useDashboardData";

type Message = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-analysis`;

const SUGGESTIONS = [
  "Analise a concorrência para fones Bluetooth no ML",
  "Qual a melhor estratégia de preço para produtos eletrônicos?",
  "Sugira um título otimizado para Capinha iPhone 15 Pro",
  "Como melhorar a margem dos meus produtos?",
  "Quais categorias estão em alta no Mercado Livre?",
];

const REPORT_TRIGGERS = ["gerar relatório", "gerar relatorio", "relatório", "relatorio", "relatório pdf", "relatorio pdf"];

const periodLabels: Record<PeriodFilter, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "14d": "14 dias",
  "15d": "15 dias",
  "30d": "30 dias",
  "39d": "39 dias",
  "6m": "6 meses",
  "1a": "1 ano",
};

export default function ChatIA() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<PeriodFilter>("30d");
  const scrollRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleGenerateReport = useCallback((period: PeriodFilter) => {
    setReportPeriod(period);
    setShowReport(true);
    const periodName = periodLabels[period];
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "gerar relatório" },
      { role: "assistant", content: `Relatório de métricas (${periodName}) gerado! Clique no botão "Imprimir PDF" abaixo para salvar como PDF.` },
    ]);
  }, []);

  const handlePrintReport = useCallback(() => {
    if (!reportRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Permita pop-ups para imprimir o relatório");
      return;
    }
    const content = reportRef.current.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Relatório de Métricas - STOVIX</title>
        <style>
          body { margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, sans-serif; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Check for report command
    const lower = text.trim().toLowerCase();
    if (REPORT_TRIGGERS.some((t) => lower.includes(t))) {
      setShowReport(true);
      setReportPeriod("30d");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text.trim() },
        { role: "assistant", content: "Relatório de métricas gerado! Escolha o período abaixo e clique em **Imprimir PDF** para salvar." },
      ]);
      setInput("");
      return;
    }

    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada");

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY),
        },
        body: JSON.stringify({
          type: "smart_chat",
          message: text.trim(),
          history: [...messages, userMsg].slice(-30),
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        throw new Error(errData?.error || "Erro ao consultar IA");
      }

      if (!resp.body) throw new Error("Sem resposta");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar mensagem");
      if (!assistantSoFar) {
        setMessages((prev) => prev.filter((m) => m !== userMsg));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ia-hub")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Chat IA</h1>
          <p className="text-muted-foreground text-sm">Converse sobre concorrência, preços, demanda e estratégias</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setShowReport(true); setReportPeriod("30d"); }}>
          <FileText className="h-4 w-4 mr-1" /> Gerar Relatório PDF
        </Button>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* Report Panel */}
      {showReport && (
        <Card className="shrink-0 border-primary/30">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Relatório de Métricas
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Período:</span>
                <Select value={reportPeriod} onValueChange={(v) => setReportPeriod(v as PeriodFilter)}>
                  <SelectTrigger className="h-7 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(periodLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="default" onClick={handlePrintReport}>
                <FileText className="h-3.5 w-3.5 mr-1" /> Imprimir PDF
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowReport(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 max-h-[300px] overflow-y-auto">
            <ReportPDF period={reportPeriod} />
          </CardContent>
        </Card>
      )}

      {/* Hidden print container */}
      <div ref={reportRef} className="hidden">
        {showReport && <ReportPDF period={reportPeriod} />}
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">Assistente de E-commerce</h3>
                <p className="text-muted-foreground text-sm mt-1">Pergunte sobre concorrência, preços, demanda ou estratégias de venda</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {SUGGESTIONS.map((s, i) => (
                  <Button key={i} variant="outline" size="sm" className="text-xs" onClick={() => sendMessage(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-4 shrink-0">
          <div className="flex gap-2">
            <Textarea
              placeholder="Pergunte sobre concorrência, preços, demanda..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              disabled={isLoading}
              rows={1}
              className="resize-none min-h-[40px]"
            />
            <Button onClick={() => sendMessage(input)} disabled={isLoading || !input.trim()} size="icon">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
