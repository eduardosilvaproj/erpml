import { useState, useEffect } from "react";
import {
  Package, ShoppingBag, Warehouse, Users, TrendingUp, TrendingDown,
  ArrowRightLeft, FileText, ScanBarcode, Monitor, ArrowUpRight,
  ArrowDownRight, AlertTriangle, Sparkles, DollarSign, Percent,
  Truck, Send, UserPlus, Trophy, AlertCircle, Clock, Star,
  ShoppingCart, Target, BarChart3, Loader2, ChevronRight,
  Pin, Settings2, CheckSquare, Square, Building2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { useDashboardData, type PeriodFilter } from "@/hooks/useDashboardData";

const periodLabels: Record<PeriodFilter, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "15d": "15 dias",
  "30d": "30 dias",
};

const allModules = [
  { id: "produtos", title: "Produtos", desc: "Cadastro e gestão", icon: Package, url: "/produtos" },
  { id: "entrada-nota", title: "Entrada Nota", desc: "Importar notas", icon: FileText, url: "/entrada-nota" },
  { id: "conferencia", title: "Conferência", desc: "Bip de recebimento", icon: ScanBarcode, url: "/conferencia" },
  { id: "estoque", title: "Estoque", desc: "Físico + FULL", icon: Warehouse, url: "/estoque" },
  { id: "envio-full", title: "Envio FULL", desc: "Movimentações", icon: ArrowRightLeft, url: "/movimentacao-full" },
  { id: "pdv", title: "PDV", desc: "Ponto de Venda", icon: Monitor, url: "/pdv" },
  { id: "crm", title: "CRM", desc: "Clientes", icon: Users, url: "/crm" },
  { id: "vendas-ml", title: "Vendas ML", desc: "Mercado Livre", icon: ShoppingBag, url: "/integracao-ml" },
];

const FAVORITES_KEY = "erp-dashboard-favorites";
const defaultFavorites = allModules.map((m) => m.id);

function loadFavorites(): string[] {
  try {
    const saved = localStorage.getItem(FAVORITES_KEY);
    if (saved) return JSON.parse(saved) as string[];
  } catch {}
  return defaultFavorites;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function TrendBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value === 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
      — Sem variação
    </span>
  );

  const isUp = value > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      isUp
        ? "text-success bg-success/10"
        : "text-destructive bg-destructive/10"
    }`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? "+" : ""}{value}{suffix}
    </span>
  );
}

function SetupChecklist({ totalProducts, totalCustomers }: { totalProducts: number; totalCustomers: number }) {
  const [expanded, setExpanded] = useState(false);
  const steps = [
    { label: "Empresa configurada", done: true, url: "" },
    { label: "Cadastre seu primeiro produto", done: totalProducts > 0, url: "/produtos", cta: "Ir para Produtos" },
    { label: "Importe seu estoque", done: false, url: "/estoque", cta: "Ir para Estoque" },
    { label: "Registre sua primeira venda", done: false, url: "/pdv", cta: "Ir para PDV" },
    { label: "Adicione um cliente", done: totalCustomers > 0, url: "/crm", cta: "Ir para CRM" },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Settings2 className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-foreground">Configure seu sistema</span>
              <span className="text-xs text-muted-foreground">{completedCount} de {steps.length} concluídos</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs h-8 px-3 shrink-0 text-primary"
          >
            {expanded ? "Ocultar" : "Ver tarefas"}
          </Button>
        </div>

        {expanded && (
          <div className="mt-4 space-y-2 animate-accordion-down">
            {steps.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${step.done ? "bg-success/5" : "bg-muted/30"}`}>
                {step.done ? (
                  <CheckSquare className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <span className={`text-sm flex-1 ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {step.label}
                </span>
                {!step.done && step.cta && (
                  <Link to={step.url}>
                    <Button size="sm" variant="outline" className="text-xs h-7 px-3">
                      {step.cta}
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const Index = () => {
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const { data, isLoading } = useDashboardData(period);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [isCustomizing, setIsCustomizing] = useState(false);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const showSetupChecklist = data && data.totalProducts === 0 && data.totalCustomers === 0;

  return (
    <div className="space-y-8">
      {/* Header + Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1.5">Visão geral do seu negócio</p>
        </div>
        <div className="flex items-center gap-1.5 bg-card/60 border border-border rounded-xl p-1">
          {(Object.keys(periodLabels) as PeriodFilter[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p)}
              className={`text-xs h-8 px-3 rounded-lg ${
                period === p
                  ? "shadow-primary-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {periodLabels[p]}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-l-[3px] border-l-muted">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-14" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
                <CardContent className="space-y-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-14 w-full rounded-xl" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : data ? (
        <>
          {/* Primary KPIs */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="hover-lift border-l-[3px] border-l-primary">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="rounded-xl bg-primary/10 p-2.5">
                    <ShoppingCart className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <TrendBadge value={data.salesTrend} />
                </div>
                <p className="text-2xl font-bold text-foreground leading-none">{data.totalSales}</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Vendas no Período</p>
              </CardContent>
            </Card>

            <Card className="hover-lift border-l-[3px] border-l-success">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="rounded-xl bg-success/10 p-2.5">
                    <DollarSign className="h-5 w-5 text-success" strokeWidth={1.75} />
                  </div>
                  <TrendBadge value={data.revenueTrend} />
                </div>
                <p className="text-2xl font-bold text-foreground leading-none">{formatCurrency(data.revenue)}</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Receita Bruta</p>
              </CardContent>
            </Card>

            <Card className="hover-lift border-l-[3px] border-l-warning">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="rounded-xl bg-warning/10 p-2.5">
                    <TrendingUp className="h-5 w-5 text-warning" strokeWidth={1.75} />
                  </div>
                  <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    data.netProfit >= 0 ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
                  }`}>
                    {data.netProfit >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {data.profitMargin.toFixed(1)}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground leading-none">{formatCurrency(data.netProfit)}</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Lucro Líquido</p>
              </CardContent>
            </Card>

            <Card className="hover-lift border-l-[3px] border-l-primary">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="rounded-xl bg-primary/10 p-2.5">
                    <Target className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <TrendBadge value={data.avgTicketTrend} />
                </div>
                <p className="text-2xl font-bold text-foreground leading-none">{formatCurrency(data.avgTicket)}</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Ticket Médio</p>
              </CardContent>
            </Card>
          </div>

          {/* Secondary KPIs - compact, no colored border */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card className="hover-lift bg-card/70 border-border/60">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg bg-warning/10 p-2">
                  <Percent className="h-4 w-4 text-warning" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground leading-none">{data.profitMargin.toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Margem de Lucro</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-lift bg-card/70 border-border/60">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg bg-destructive/10 p-2">
                  <Truck className="h-4 w-4 text-destructive" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground leading-none">{data.pendingShipments}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Pendentes de Envio</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-lift bg-card/70 border-border/60">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg bg-success/10 p-2">
                  <Send className="h-4 w-4 text-success" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground leading-none">{data.sentShipments}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Enviados</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-lift bg-card/70 border-border/60">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <UserPlus className="h-4 w-4 text-primary" strokeWidth={1.75} />
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-xl font-bold text-foreground leading-none">{data.newCustomers}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Novos Clientes</p>
                  </div>
                  <TrendBadge value={data.newCustomersTrend} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Products + Alerts/Setup side by side */}
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
            {/* Top Products Ranking */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-5 w-5 text-warning" />
                  Produtos Mais Vendidos
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {periodLabels[period]}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.topProducts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Nenhuma venda no período
                  </div>
                ) : (
                  data.topProducts.map((product, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className={`flex items-center justify-center h-8 w-8 rounded-lg font-bold text-sm ${
                        i === 0
                          ? "bg-warning/20 text-warning"
                          : i === 1
                          ? "bg-muted-foreground/20 text-muted-foreground"
                          : i === 2
                          ? "bg-warning/10 text-warning/70"
                          : "bg-muted/50 text-muted-foreground"
                      }`}>
                        {i + 1}º
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {product.qty} vendido(s) • {formatCurrency(product.revenue)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {product.qty} un
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Setup Checklist or Alerts */}
            {showSetupChecklist ? (
              <SetupChecklist totalProducts={data.totalProducts} totalCustomers={data.totalCustomers} />
            ) : (
              <Card className={data.alerts.length > 0 ? "border-warning/30" : ""}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertCircle className={`h-5 w-5 ${data.alerts.length > 0 ? "text-warning" : "text-muted-foreground"}`} />
                    Alertas Operacionais
                    {data.alerts.length > 0 && (
                      <Badge variant="destructive" className="ml-auto text-[10px]">
                        {data.alerts.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.alerts.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Nenhum alerta no momento
                      <p className="text-xs mt-1 text-muted-foreground/60">Tudo funcionando bem!</p>
                    </div>
                  ) : (
                    data.alerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-xl border ${
                          alert.type === "error"
                            ? "bg-destructive/5 border-destructive/20"
                            : alert.type === "warning"
                            ? "bg-warning/5 border-warning/20"
                            : "bg-primary/5 border-primary/20"
                        }`}
                      >
                        {alert.type === "error" ? (
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        ) : alert.type === "warning" ? (
                          <Clock className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        )}
                        <p className="text-sm text-foreground">{alert.message}</p>
                      </div>
                    ))
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 mt-3">
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <p className="text-lg font-bold text-foreground">{data.totalProducts}</p>
                      <p className="text-[10px] text-muted-foreground">Produtos Ativos</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <p className="text-lg font-bold text-foreground">{data.totalCustomers}</p>
                      <p className="text-[10px] text-muted-foreground">Total Clientes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Meus Atalhos */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">Meus Atalhos</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCustomizing(!isCustomizing)}
                className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8"
              >
                <Pin className="h-3.5 w-3.5" />
                {isCustomizing ? "Concluir" : "Personalizar"}
              </Button>
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {allModules.map((mod) => {
                const isFav = favorites.includes(mod.id);
                return (
                  <div key={mod.id} className="relative">
                    {isCustomizing && (
                      <button
                        onClick={() => toggleFavorite(mod.id)}
                        className={`absolute -top-2 -right-2 z-10 h-7 w-7 rounded-full flex items-center justify-center border transition-all ${
                          isFav
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-card border-border text-muted-foreground"
                        }`}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <Link to={mod.url}>
                      <Card className={`hover-lift cursor-pointer group h-full transition-opacity ${
                        !isFav && !isCustomizing ? "opacity-40" : !isFav ? "opacity-50" : ""
                      }`}>
                        <CardContent className="flex items-center gap-4 p-5">
                          <div className="rounded-xl bg-primary/8 p-3 group-hover:bg-primary/20 transition-colors duration-200">
                            <mod.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm">{mod.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{mod.desc}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Index;
