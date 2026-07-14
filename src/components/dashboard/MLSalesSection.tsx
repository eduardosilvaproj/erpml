import { useMemo } from "react";
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { useMLConnection } from "@/hooks/useMLData";
import { useMLDashboardMetrics } from "@/hooks/useMLDashboardMetrics";
import { formatCurrency } from "@/lib/formatters";
import type { PeriodFilter } from "@/hooks/useDashboardData";

const PERIOD_DAYS: Record<PeriodFilter, number> = {
  today: 1,
  "7d": 7,
  "15d": 15,
  "30d": 30,
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Pagos",
  confirmed: "Confirmados",
  payment_required: "Aguardando pgto",
  payment_in_process: "Processando",
  partially_paid: "Parcial",
  cancelled: "Cancelados",
  invalid: "Inválidos",
  unknown: "Outros",
};

function MLTrend({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
        — Sem variação
      </span>
    );
  }
  const isUp = value > 0;
  return (
    <span
      className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
        isUp ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
      }`}
    >
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? "+" : ""}
      {value}%
    </span>
  );
}

function MLCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  iconColor,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  iconColor: string;
}) {
  return (
    <Card className="hover-lift border-border/50">
      <CardContent className="px-3 py-2 lg:px-5 lg:py-3">
        <div className="flex items-center gap-1.5 lg:gap-2">
          <Icon className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${iconColor}`} strokeWidth={1.75} />
          <span className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </span>
        </div>
        <p className="text-xl lg:text-3xl font-bold text-foreground leading-none mt-2 lg:mt-3 truncate">
          {value}
        </p>
        <div className="mt-2 lg:mt-3 flex items-center gap-2">
          {trend !== undefined && <MLTrend value={trend} />}
          {sub && <span className="text-[10px] text-muted-foreground truncate">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function MLSalesSection({ period }: { period: PeriodFilter }) {
  const { data: connection, isLoading: loadingConn } = useMLConnection();
  const periodDays = PERIOD_DAYS[period] ?? 30;
  const { metrics, isLoading } = useMLDashboardMetrics(periodDays);

  const hasChartData = useMemo(
    () => metrics.dailyData.some((d) => d.receita > 0),
    [metrics.dailyData]
  );

  if (loadingConn) return null;
  if (!connection) return null;

  const sortedStatus = Object.entries(metrics.statusCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShoppingBag className="h-4 w-4 text-primary" />
        <h2 className="text-sm lg:text-base font-semibold text-foreground">
          Vendas Mercado Livre
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {connection.seller_nickname ? `· ${connection.seller_nickname}` : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 lg:p-5">
                <Skeleton className="h-16 lg:h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
            <MLCard
              icon={ShoppingBag}
              label="Pedidos ML"
              value={String(metrics.totalOrders)}
              iconColor="text-primary"
            />
            <MLCard
              icon={DollarSign}
              label="Receita Bruta ML"
              value={formatCurrency(metrics.grossRevenue)}
              trend={metrics.revenueTrend}
              iconColor="text-success"
            />
            <MLCard
              icon={TrendingUp}
              label="Líquido ML"
              value={formatCurrency(metrics.netRevenue)}
              sub={`Margem ${metrics.margin.toFixed(1)}%`}
              iconColor="text-warning"
            />
            <MLCard
              icon={Target}
              label="Ticket Médio ML"
              value={formatCurrency(metrics.avgTicket)}
              iconColor="text-primary"
            />
          </div>

          {sortedStatus.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sortedStatus.map(([status, count]) => (
                <Badge key={status} variant="secondary" className="text-[10px]">
                  {STATUS_LABELS[status] || status}: {count}
                </Badge>
              ))}
            </div>
          )}

          <Card className="border-border/50">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Vendas ML por dia
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {hasChartData ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={metrics.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <RechartsTooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="comissao" name="Comissão" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="frete" name="Frete" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Nenhuma venda do Mercado Livre no período. Conecte e sincronize na tela de Integração ML.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
