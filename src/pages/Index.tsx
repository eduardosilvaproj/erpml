import { useState } from "react";
import {
  Package, Warehouse, TrendingUp, ArrowUpRight, ArrowDownRight,
  DollarSign, Percent, Truck, Send, UserPlus,
  ShoppingCart, Target, Store
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

          {/* Quick Access */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-4">Acesso Rápido</h2>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {quickAccessSections.map((sec) => (
                <Link key={sec.id} to={sec.url}>
                  <Card className="hover-lift cursor-pointer group h-full min-h-[150px] border-border/40 bg-card/60 hover:border-primary/30 transition-all">
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center gap-3 h-full">
                      <div className="rounded-2xl bg-primary/10 p-4 group-hover:bg-primary/15 transition-colors">
                        <sec.icon className="h-12 w-12 text-primary" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-base">{sec.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{sec.desc}</p>
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
