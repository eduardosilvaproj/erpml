import { useState } from "react";
import {
  Package, ShoppingBag, Warehouse, Users, TrendingUp,
  ArrowRightLeft, FileText, ScanBarcode, Monitor, ArrowUpRight,
  ArrowDownRight, Sparkles, DollarSign, Percent,
  Truck, Send, UserPlus, Trophy, AlertCircle, Clock, Star,
  ShoppingCart, Target, BarChart3, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

const quickAccessSections = [
  { id: "cadastros", title: "Cadastros", desc: "Produtos, kits, equipe e CRM", icon: Package, url: "/produtos" },
  { id: "estoque", title: "Estoque", desc: "Saldos, notas e conferência", icon: Warehouse, url: "/estoque" },
  { id: "vendas", title: "Vendas", desc: "PDV, campanhas e integrações", icon: Store, url: "/pdv" },
  { id: "gestao", title: "Gestão", desc: "Relatórios e financeiro", icon: TrendingUp, url: "/painel-hub" },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function TrendBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value === 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
      — Sem variação
    </span>
  );
  const isUp = value > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      isUp ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
    }`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? "+" : ""}{value}{suffix}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, trend, iconColor }: {
  icon: any; label: string; value: string; trend?: number; iconColor: string;
}) {
  return (
    <Card className="hover-lift border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} strokeWidth={1.75} />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-3xl font-bold text-foreground leading-none mt-3">{value}</p>
        <div className="mt-3">
          {trend !== undefined && <TrendBadge value={trend} />}
        </div>
      </CardContent>
    </Card>
  );
}

const Index = () => {
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const { data, isLoading } = useDashboardData(period);

  return (
    <div className="space-y-8">
      {/* Period Filter */}
      <div className="flex items-center gap-1.5">
        {(Object.keys(periodLabels) as PeriodFilter[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`text-xs font-medium h-8 px-4 rounded-full border transition-all ${
              period === p
                ? "bg-foreground text-background border-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))}
          </div>
        </div>
      ) : data ? (
        <>
          {/* Primary KPIs - row 1 */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={ShoppingCart} label="Vendas" value={String(data.totalSales)} trend={data.salesTrend} iconColor="text-primary" />
            <MetricCard icon={DollarSign} label="Receita Bruta" value={formatCurrency(data.revenue)} trend={data.revenueTrend} iconColor="text-success" />
            <MetricCard icon={TrendingUp} label="Lucro Líquido" value={formatCurrency(data.netProfit)} trend={parseFloat(data.profitMargin.toFixed(1))} iconColor="text-warning" />
            <MetricCard icon={Target} label="Ticket Médio" value={formatCurrency(data.avgTicket)} trend={data.avgTicketTrend} iconColor="text-primary" />
          </div>

          {/* Secondary KPIs - row 2 */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Percent} label="Margem" value={`${data.profitMargin.toFixed(1)}%`} iconColor="text-warning" />
            <MetricCard icon={Truck} label="Pendentes" value={String(data.pendingShipments)} iconColor="text-destructive" />
            <MetricCard icon={Send} label="Enviados" value={String(data.sentShipments)} iconColor="text-success" />
            <MetricCard icon={UserPlus} label="Novos Clientes" value={String(data.newCustomers)} trend={data.newCustomersTrend} iconColor="text-primary" />
          </div>

          {/* Top Products + Alerts */}
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-warning" />
                  Produtos Mais Vendidos
                  <Badge variant="secondary" className="ml-auto text-[10px]">{periodLabels[period]}</Badge>
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
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className={`flex items-center justify-center h-7 w-7 rounded-md font-bold text-xs ${
                        i === 0 ? "bg-warning/20 text-warning" : i === 1 ? "bg-muted-foreground/20 text-muted-foreground" : "bg-muted/50 text-muted-foreground"
                      }`}>{i + 1}º</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-[11px] text-muted-foreground">{product.qty}x • {formatCurrency(product.revenue)}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertCircle className={`h-4 w-4 ${data.alerts.length > 0 ? "text-warning" : "text-muted-foreground"}`} />
                  Alertas Operacionais
                  {data.alerts.length > 0 && (
                    <Badge variant="destructive" className="ml-auto text-[10px]">{data.alerts.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.alerts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Nenhum alerta no momento
                  </div>
                ) : (
                  data.alerts.map((alert, i) => (
                    <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                      alert.type === "error" ? "bg-destructive/5 border-destructive/20"
                        : alert.type === "warning" ? "bg-warning/5 border-warning/20"
                        : "bg-primary/5 border-primary/20"
                    }`}>
                      {alert.type === "error" ? <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                        : <Clock className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />}
                      <p className="text-xs text-foreground">{alert.message}</p>
                    </div>
                  ))
                )}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 mt-3">
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

          {/* Quick Access Modules */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-4">Acesso Rápido</h2>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {allModules.map((mod) => (
                <Link key={mod.id} to={mod.url}>
                  <Card className="hover-lift cursor-pointer group h-full border-border/40 bg-card/60 hover:border-primary/30 transition-all">
                    <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                      <div className="rounded-2xl bg-primary/8 p-3.5 group-hover:bg-primary/15 transition-colors">
                        <mod.icon className="h-8 w-8 text-primary" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{mod.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{mod.desc}</p>
                      </div>
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
