import { useState } from "react";
import {
  Package, ShoppingBag, Warehouse, Users, TrendingUp, TrendingDown,
  ArrowRightLeft, FileText, ScanBarcode, Monitor, ArrowUpRight,
  ArrowDownRight, AlertTriangle, Sparkles, DollarSign, Percent,
  Truck, Send, UserPlus, Trophy, AlertCircle, Clock, Star,
  ShoppingCart, Target, BarChart3, Loader2, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useDashboardData, type PeriodFilter } from "@/hooks/useDashboardData";

const periodLabels: Record<PeriodFilter, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "15d": "15 dias",
  "30d": "30 dias",
};

const modules = [
  { title: "Produtos", desc: "Cadastro e gestão", icon: Package, url: "/produtos" },
  { title: "Entrada XML", desc: "Importar notas", icon: FileText, url: "/entrada-xml" },
  { title: "Conferência", desc: "Bip de recebimento", icon: ScanBarcode, url: "/conferencia" },
  { title: "Estoque", desc: "Físico + FULL", icon: Warehouse, url: "/estoque" },
  { title: "Envio FULL", desc: "Movimentações", icon: ArrowRightLeft, url: "/movimentacao-full" },
  { title: "PDV", desc: "Ponto de Venda", icon: Monitor, url: "/pdv" },
  { title: "CRM", desc: "Clientes", icon: Users, url: "/crm" },
  { title: "Vendas ML", desc: "Mercado Livre", icon: ShoppingBag, url: "/integracao-ml" },
];

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

const Index = () => {
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const { data, isLoading } = useDashboardData(period);

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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <>
          {/* Primary KPIs - 4 columns */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {/* Total Vendas */}
            <Card className="hover-lift border-l-[3px] border-l-primary">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="rounded-xl bg-primary/10 p-2.5">
                    <ShoppingCart className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <TrendBadge value={data.salesTrend} />
                </div>
                <p className="text-[28px] font-extrabold text-foreground leading-none">{data.totalSales}</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Vendas no Período</p>
              </CardContent>
            </Card>

            {/* Receita Bruta */}
            <Card className="hover-lift border-l-[3px] border-l-success">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="rounded-xl bg-success/10 p-2.5">
                    <DollarSign className="h-5 w-5 text-success" strokeWidth={1.75} />
                  </div>
                  <TrendBadge value={data.revenueTrend} />
                </div>
                <p className="text-[26px] font-extrabold text-foreground leading-none">{formatCurrency(data.revenue)}</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Receita Bruta</p>
              </CardContent>
            </Card>

            {/* Lucro Líquido */}
            <Card className="hover-lift border-l-[3px] border-l-warning">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="rounded-xl bg-warning/10 p-2.5">
                    <TrendingUp className="h-5 w-5 text-warning" strokeWidth={1.75} />
                  </div>
                  <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    data.netProfit >= 0
                      ? "text-success bg-success/10"
                      : "text-destructive bg-destructive/10"
                  }`}>
                    {data.netProfit >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {data.profitMargin.toFixed(1)}%
                  </span>
                </div>
                <p className="text-[26px] font-extrabold text-foreground leading-none">{formatCurrency(data.netProfit)}</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Lucro Líquido</p>
              </CardContent>
            </Card>

            {/* Ticket Médio */}
            <Card className="hover-lift border-l-[3px] border-l-primary">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="rounded-xl bg-primary/10 p-2.5">
                    <Target className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <TrendBadge value={data.avgTicketTrend} />
                </div>
                <p className="text-[26px] font-extrabold text-foreground leading-none">{formatCurrency(data.avgTicket)}</p>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Ticket Médio</p>
              </CardContent>
            </Card>
          </div>

          {/* Secondary KPIs - 4 columns */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {/* Margem de Lucro */}
            <Card className="hover-lift">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-xl bg-warning/10 p-2.5">
                  <Percent className="h-5 w-5 text-warning" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{data.profitMargin.toFixed(1)}%</p>
                  <p className="text-[11px] text-muted-foreground">Margem de Lucro</p>
                </div>
              </CardContent>
            </Card>

            {/* Pendentes de Envio */}
            <Card className="hover-lift">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-xl bg-destructive/10 p-2.5">
                  <Truck className="h-5 w-5 text-destructive" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{data.pendingShipments}</p>
                  <p className="text-[11px] text-muted-foreground">Pendentes de Envio</p>
                </div>
              </CardContent>
            </Card>

            {/* Enviados no Período */}
            <Card className="hover-lift">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-xl bg-success/10 p-2.5">
                  <Send className="h-5 w-5 text-success" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{data.sentShipments}</p>
                  <p className="text-[11px] text-muted-foreground">Enviados</p>
                </div>
              </CardContent>
            </Card>

            {/* Novos Clientes */}
            <Card className="hover-lift">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <UserPlus className="h-5 w-5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <p className="text-xl font-bold text-foreground">{data.newCustomers}</p>
                    <p className="text-[11px] text-muted-foreground">Novos Clientes</p>
                  </div>
                  <TrendBadge value={data.newCustomersTrend} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Products + Alerts side by side */}
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

            {/* Alerts & Issues */}
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

                {/* Quick summary stats */}
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
          </div>

          {/* Módulos */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">Módulos</h2>
              <span className="text-xs text-muted-foreground">{modules.length} disponíveis</span>
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {modules.map((mod) => (
                <Link key={mod.title} to={mod.url}>
                  <Card className="hover-lift cursor-pointer group h-full">
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
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Index;
