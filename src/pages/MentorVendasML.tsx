import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LayoutDashboard, Search, Star, TrendingUp, Sparkles, Target, CheckCircle2,
  ArrowRight, DollarSign, AlertTriangle, Lightbulb, Trophy, Zap, BarChart3,
  ShieldCheck, Megaphone, Calculator, Package, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import ReactMarkdown from "react-markdown";

const STORAGE_KEY_DIAG = "mentor_diagnostico";

/* ─── Tab 1: Dashboard do Vendedor ─── */
function DashboardTab() {
  const companyId = useCompanyId();
  const [stats, setStats] = useState({ totalProducts: 0, totalSales: 0, revenue: 0 });

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const [{ count: prodCount }, { data: sales }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("sales").select("total_value").eq("company_id", companyId).eq("status", "completed"),
      ]);
      setStats({
        totalProducts: prodCount || 0,
        totalSales: sales?.length || 0,
        revenue: sales?.reduce((s, v) => s + (v.total_value || 0), 0) || 0,
      });
    })();
  }, [companyId]);

  const progress = Math.min(100, Math.round((stats.totalSales / 50) * 100));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Produtos Cadastrados", value: stats.totalProducts, icon: Package, color: "text-blue-500" },
          { label: "Vendas Realizadas", value: stats.totalSales, icon: TrendingUp, color: "text-green-500" },
          { label: "Faturamento", value: `R$ ${stats.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-amber-500" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl bg-muted flex items-center justify-center ${s.color}`}>
                <s.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> Progresso do Vendedor</CardTitle>
          <CardDescription>Meta: 50 vendas para o próximo nível</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">{stats.totalSales}/50 vendas — {progress}%</p>
        </CardContent>
      </Card>

      {/* Opportunity & Action */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm mb-1">Oportunidade de Melhoria</p>
                <p className="text-sm text-muted-foreground">Otimize os títulos dos seus anúncios com palavras-chave relevantes para aumentar a visibilidade em até 40%.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900/50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm mb-1">Próxima Ação Recomendada</p>
                <p className="text-sm text-muted-foreground">Revise a precificação dos seus 5 produtos mais vendidos para garantir margem competitiva.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── Tab 2: Diagnóstico Inteligente ─── */
function DiagnosticoTab() {
  const [level, setLevel] = useState("");
  const [productType, setProductType] = useState("");
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DIAG);
      if (saved) {
        const d = JSON.parse(saved);
        setPlan(d.plan);
        setChecklist(d.checklist || {});
      }
    } catch {}
  }, []);

  const saveDiag = (p: string, c: Record<string, boolean>) => {
    localStorage.setItem(STORAGE_KEY_DIAG, JSON.stringify({ plan: p, checklist: c }));
  };

  const generatePlan = async () => {
    if (!level || !productType || !goal) { toast.error("Preencha todos os campos"); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Login necessário");

      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-ai`;
      const prompt = `Crie um plano de ação detalhado em formato de checklist (com itens numerados) para um vendedor de nível "${level}" que vende "${productType}" e quer "${goal}". Máximo 8 itens, cada um com uma frase curta e acionável.`;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      if (!resp.ok) throw new Error("Erro ao gerar plano");

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) result += c;
          } catch {}
        }
      }

      setPlan(result);
      const newChecklist: Record<string, boolean> = {};
      result.split("\n").filter(l => /^\d/.test(l.trim())).forEach((_, i) => { newChecklist[String(i)] = false; });
      setChecklist(newChecklist);
      saveDiag(result, newChecklist);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCheck = (key: string) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    if (plan) saveDiag(plan, updated);
  };

  const planLines = plan?.split("\n").filter(l => l.trim()) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Search className="h-5 w-5 text-primary" /> Diagnóstico do Vendedor</CardTitle>
          <CardDescription>Responda as perguntas abaixo para receber um plano de ação personalizado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nível do Vendedor</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Produto</Label>
              <Input value={productType} onChange={e => setProductType(e.target.value)} placeholder="Ex: Eletrônicos, Roupas..." />
            </div>
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select value={goal} onValueChange={setGoal}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Faturar R$5.000/mês">R$ 5.000/mês</SelectItem>
                  <SelectItem value="Faturar R$10.000/mês">R$ 10.000/mês</SelectItem>
                  <SelectItem value="Faturar R$20.000/mês">R$ 20.000/mês</SelectItem>
                  <SelectItem value="Faturar R$50.000/mês">R$ 50.000/mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={generatePlan} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar Plano de Ação
          </Button>
        </CardContent>
      </Card>

      {plan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-500" /> Seu Plano de Ação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {planLines.map((line, i) => {
              const isNumbered = /^\d/.test(line.trim());
              if (!isNumbered) return <p key={i} className="text-sm text-muted-foreground">{line}</p>;
              return (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox checked={!!checklist[String(i)]} onCheckedChange={() => toggleCheck(String(i))} className="mt-0.5" />
                  <span className={`text-sm flex-1 ${checklist[String(i)] ? "line-through text-muted-foreground" : ""}`}>{line.replace(/^\d+[\.\)]\s*/, "")}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Tab 3: Otimização de Anúncios ─── */
function OtimizacaoTab() {
  const [product, setProduct] = useState("");
  const [titles, setTitles] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculator
  const [cost, setCost] = useState("");
  const [taxRate, setTaxRate] = useState("16");
  const [margin, setMargin] = useState("30");

  const calcPrice = () => {
    const c = parseFloat(cost);
    const t = parseFloat(taxRate) / 100;
    const m = parseFloat(margin) / 100;
    if (isNaN(c) || isNaN(t) || isNaN(m) || (1 - t - m) <= 0) return null;
    return c / (1 - t - m);
  };

  const generateTitles = async () => {
    if (!product.trim()) { toast.error("Digite o nome do produto"); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Login necessário");

      const prompt = `Para o produto "${product}" no Mercado Livre, gere:
1. Três sugestões de título otimizado (com palavras-chave, max 60 caracteres cada)
2. Três dicas rápidas para melhorar o anúncio deste produto
Formate de forma clara com números.`;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentor-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      if (!resp.ok) throw new Error("Erro");

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "", result = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") break;
          try { const p = JSON.parse(j); const c = p.choices?.[0]?.delta?.content; if (c) result += c; } catch {}
        }
      }
      setTitles(result);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const idealPrice = calcPrice();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Otimizador de Anúncios</CardTitle>
          <CardDescription>Gere títulos otimizados e dicas de melhoria para seus produtos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={product} onChange={e => setProduct(e.target.value)} placeholder="Nome do produto..." className="flex-1"
              onKeyDown={e => { if (e.key === "Enter") generateTitles(); }} />
            <Button onClick={generateTitles} disabled={loading} className="gap-2 shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar
            </Button>
          </div>
          {titles && (
            <div className="bg-muted/50 p-4 rounded-xl">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{titles}</ReactMarkdown>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Calculator className="h-5 w-5 text-green-500" /> Calculadora de Preço Ideal</CardTitle>
          <CardDescription>Encontre o preço ideal considerando custo, taxas e margem</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Custo do Produto (R$)</Label>
              <Input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Taxa ML (%)</Label>
              <Input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="16" />
            </div>
            <div className="space-y-2">
              <Label>Margem Desejada (%)</Label>
              <Input type="number" value={margin} onChange={e => setMargin(e.target.value)} placeholder="30" />
            </div>
          </div>
          {idealPrice && idealPrice > 0 && cost && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-xl p-4 flex items-center gap-4">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Preço Ideal de Venda</p>
                <p className="text-2xl font-bold text-green-600">R$ {idealPrice.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Lucro estimado: R$ {(idealPrice - parseFloat(cost) - idealPrice * parseFloat(taxRate) / 100).toFixed(2)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Tab 4: Reputação & Performance ─── */
function ReputacaoTab() {
  const [sales, setSales] = useState("100");
  const [delays, setDelays] = useState("2");
  const [complaints, setComplaints] = useState("1");

  const totalSales = parseInt(sales) || 0;
  const totalDelays = parseInt(delays) || 0;
  const totalComplaints = parseInt(complaints) || 0;
  const delayRate = totalSales > 0 ? (totalDelays / totalSales) * 100 : 0;
  const complaintRate = totalSales > 0 ? (totalComplaints / totalSales) * 100 : 0;

  let reputation: { label: string; color: string; bg: string; icon: typeof ShieldCheck } =
    delayRate < 3 && complaintRate < 1
      ? { label: "Verde (Boa)", color: "text-green-600", bg: "bg-green-100 dark:bg-green-950/40", icon: ShieldCheck }
      : delayRate < 6 && complaintRate < 3
        ? { label: "Amarela (Atenção)", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950/40", icon: AlertTriangle }
        : { label: "Vermelha (Crítica)", color: "text-red-600", bg: "bg-red-100 dark:bg-red-950/40", icon: AlertTriangle };

  const tips = [
    "Envie os pedidos no mesmo dia ou no dia seguinte",
    "Use embalagens resistentes para evitar reclamações por avaria",
    "Responda perguntas em menos de 1 hora",
    "Ofereça pós-venda proativo via mensagens do ML",
    "Mantenha estoque atualizado para evitar cancelamentos",
    "Use frete Full para entregas mais rápidas",
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" /> Simulador de Reputação</CardTitle>
          <CardDescription>Simule sua reputação com base nos indicadores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2"><Label>Vendas no Período</Label><Input type="number" value={sales} onChange={e => setSales(e.target.value)} /></div>
            <div className="space-y-2"><Label>Atrasos</Label><Input type="number" value={delays} onChange={e => setDelays(e.target.value)} /></div>
            <div className="space-y-2"><Label>Reclamações</Label><Input type="number" value={complaints} onChange={e => setComplaints(e.target.value)} /></div>
          </div>

          <div className={`${reputation.bg} rounded-xl p-5 flex items-center gap-4`}>
            <reputation.icon className={`h-10 w-10 ${reputation.color}`} />
            <div>
              <p className="text-sm text-muted-foreground">Reputação Estimada</p>
              <p className={`text-xl font-bold ${reputation.color}`}>{reputation.label}</p>
              <p className="text-xs text-muted-foreground mt-1">Atrasos: {delayRate.toFixed(1)}% | Reclamações: {complaintRate.toFixed(1)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-500" /> Dicas para Melhorar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span className="text-sm">{tip}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Tab 5: Escala de Vendas ─── */
function EscalaTab() {
  const strategies = [
    {
      icon: DollarSign, color: "text-green-500", bg: "bg-green-100 dark:bg-green-950/40",
      title: "Preço Competitivo",
      desc: "Analise os concorrentes e ajuste seus preços para ficar na faixa ideal. Não precisa ser o mais barato, mas precisa ser competitivo.",
      actions: ["Pesquise os 5 primeiros colocados do seu nicho", "Use a calculadora de preço ideal", "Considere oferecer frete grátis embutido"],
    },
    {
      icon: Megaphone, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-950/40",
      title: "Anúncios Pagos (Product Ads)",
      desc: "Invista em anúncios pagos do Mercado Livre para aumentar a visibilidade dos seus produtos mais lucrativos.",
      actions: ["Comece com R$10-20/dia nos produtos top", "Monitore o ACoS (custo de anúncio sobre venda)", "Pause anúncios com ACoS acima de 15%"],
    },
    {
      icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-950/40",
      title: "Melhorar Conversão",
      desc: "Otimize seus anúncios para converter mais visitantes em compradores. Fotos, títulos e descrições fazem toda a diferença.",
      actions: ["Use fotos profissionais com fundo branco", "Título com palavras-chave relevantes", "Descrição detalhada com especificações técnicas"],
    },
    {
      icon: Zap, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-950/40",
      title: "Logística FULL",
      desc: "Envie seus produtos para o fulfillment do Mercado Livre. Entrega mais rápida = mais vendas.",
      actions: ["Selecione os produtos com maior giro", "Use o módulo Envio FULL do ERP", "Monitore níveis de estoque FULL"],
    },
    {
      icon: BarChart3, color: "text-red-500", bg: "bg-red-100 dark:bg-red-950/40",
      title: "Diversificar Catálogo",
      desc: "Não dependa de poucos produtos. Amplie seu catálogo com produtos complementares e variações.",
      actions: ["Identifique produtos complementares aos seus top", "Crie kits e combos", "Teste novos nichos com baixo investimento"],
    },
    {
      icon: Trophy, color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-950/40",
      title: "Reputação & Atendimento",
      desc: "Vendedores com boa reputação vendem mais e aparecem melhor nos resultados de busca.",
      actions: ["Responda perguntas em menos de 1h", "Envie no prazo — sempre", "Resolva reclamações rapidamente"],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {strategies.map((s, i) => (
        <Card key={i} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
              </div>
            </div>
            <div className="space-y-2 mt-3 pl-1">
              {s.actions.map((a, j) => (
                <div key={j} className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Main Page ─── */
export default function MentorVendasML() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mentor de Vendas ML</h1>
          <p className="text-sm text-muted-foreground">Central inteligente de crescimento de vendas</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="dashboard" className="flex-1 min-w-[120px] gap-1.5 text-xs sm:text-sm rounded-lg"><LayoutDashboard className="h-4 w-4" />Dashboard</TabsTrigger>
          <TabsTrigger value="diagnostico" className="flex-1 min-w-[120px] gap-1.5 text-xs sm:text-sm rounded-lg"><Search className="h-4 w-4" />Diagnóstico</TabsTrigger>
          <TabsTrigger value="otimizacao" className="flex-1 min-w-[120px] gap-1.5 text-xs sm:text-sm rounded-lg"><Sparkles className="h-4 w-4" />Otimização</TabsTrigger>
          <TabsTrigger value="reputacao" className="flex-1 min-w-[120px] gap-1.5 text-xs sm:text-sm rounded-lg"><Star className="h-4 w-4" />Reputação</TabsTrigger>
          <TabsTrigger value="escala" className="flex-1 min-w-[120px] gap-1.5 text-xs sm:text-sm rounded-lg"><TrendingUp className="h-4 w-4" />Escala</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="diagnostico"><DiagnosticoTab /></TabsContent>
        <TabsContent value="otimizacao"><OtimizacaoTab /></TabsContent>
        <TabsContent value="reputacao"><ReputacaoTab /></TabsContent>
        <TabsContent value="escala"><EscalaTab /></TabsContent>
      </Tabs>
    </div>
  );
}
