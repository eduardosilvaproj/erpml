import { useMemo, useState } from "react";
import {
  Activity, BarChart3, Clock, Package, Trophy, Truck, Loader2,
  AlertCircle, Award, Calendar,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useCompanyMembers } from "@/hooks/useCompanyData";
import {
  useDashboardSeparacao, type DashboardFilters,
} from "@/hooks/useDashboardSeparacao";

type PeriodKey = "7d" | "15d" | "30d" | "90d";

const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "15d", label: "15 dias", days: 15 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "90d", label: "90 dias", days: 90 },
];

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}
function formatNumber(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(v));
}
function formatMinutes(min: number): string {
  if (min < 1) return `${Math.round(min * 60)}s`;
  if (min < 60) return `${min.toFixed(1)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}min`;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  em_separacao: { label: "Em Separação", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  pausado: { label: "Pausado", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  aguardando_carregamento: { label: "Aguard. Coleta", cls: "bg-purple-100 text-purple-700 border-purple-200" },
  carregando: { label: "Carregando", cls: "bg-blue-100 text-blue-700 border-blue-200" },
};

const BAR_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6"];

const DashboardSeparacao = () => {
  const companyId = useCompanyId();
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [operadorId, setOperadorId] = useState<string | null>(null);

  const { data: members } = useCompanyMembers(companyId);

  const filters: DashboardFilters = useMemo(() => {
    const days = PERIOD_OPTIONS.find((p) => p.key === period)?.days || 7;
    const dateTo = new Date();
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return {
      dateFrom: toISODate(dateFrom),
      dateTo: toISODate(dateTo),
      operadorId,
    };
  }, [period, operadorId]);

  const { data, isLoading, isError, error, refetch } = useDashboardSeparacao(filters);

  const kpis = useMemo(
    () => [
      { label: "Pedidos Separados", value: formatNumber(data.totalSeparados), icon: Package, accent: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Tempo Médio", value: formatMinutes(data.tempoMedioMin), icon: Clock, accent: "text-blue-600", bg: "bg-blue-50" },
      { label: "Unidades Bipadas", value: formatNumber(data.totalUnidades), icon: BarChart3, accent: "text-violet-600", bg: "bg-violet-50" },
      {
        label: "SLA Cumprido",
        value: `${data.slaCumpridoPct.toFixed(0)}%`,
        icon: Trophy,
        accent: data.slaCumpridoPct >= 90 ? "text-emerald-600" : data.slaCumpridoPct >= 70 ? "text-amber-600" : "text-red-600",
        bg: data.slaCumpridoPct >= 90 ? "bg-emerald-50" : data.slaCumpridoPct >= 70 ? "bg-amber-50" : "bg-red-50",
      },
    ],
    [data]
  );

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <div>
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-violet-600" />
          <h1 className="text-2xl md:text-3xl font-bold">Performance da Separação</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Métricas operacionais de separação para envio ao FULL
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground mr-1" />
              {PERIOD_OPTIONS.map((p) => (
                <Button
                  key={p.key}
                  variant={period === p.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod(p.key)}
                  className="h-8"
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Operador:</span>
              <Select
                value={operadorId || "all"}
                onValueChange={(v) => setOperadorId(v === "all" ? null : v)}
              >
                <SelectTrigger className="h-8 w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os operadores</SelectItem>
                  {(members || []).map((m: any) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profile?.full_name || `Usuário ${m.user_id.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Atualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(isError || error) && (
        <Card className="border-destructive">
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2 text-destructive font-semibold">
              <AlertCircle className="h-5 w-5" />
              <span>Erro ao carregar dados do dashboard</span>
            </div>
            {error ? (
              <pre className="text-xs bg-destructive/10 p-3 rounded overflow-auto max-h-32">
                {(error as any).message || JSON.stringify(error, null, 2)}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className={`inline-flex p-2 rounded-lg ${kpi.bg} mb-3`}>
                <kpi.icon className={`h-5 w-5 ${kpi.accent}`} />
              </div>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{kpi.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.statusAtivos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4" />
              Separações em Andamento
            </CardTitle>
            <CardDescription>Status em tempo real</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.statusAtivos.map((s) => (
                <Badge key={s.status} variant="outline" className={STATUS_BADGE[s.status]?.cls}>
                  {STATUS_BADGE[s.status]?.label || s.status}: {s.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Separações por Dia
          </CardTitle>
          <CardDescription>
            {data.totalSeparados} pedidos no período · {data.throughput.toFixed(1)}/dia
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.totalSeparados === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma separação no período selecionado.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.separacoesPorDia}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="pedidos" radius={[4, 4, 0, 0]}>
                  {data.separacoesPorDia.map((_, idx) => (
                    <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4" />
            Ranking de Operadores
          </CardTitle>
          <CardDescription>Performance por operador no período</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.rankingOperadores.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Trophy className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhum operador com separação no período.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Tempo Médio</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rankingOperadores.map((op, idx) => (
                  <TableRow key={op.id || `none-${idx}`}>
                    <TableCell>
                      {idx === 0 ? (
                        <Award className="h-4 w-4 text-amber-500" />
                      ) : (
                        `${idx + 1}º`
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{op.nome}</TableCell>
                    <TableCell className="text-right">{op.pedidos}</TableCell>
                    <TableCell className="text-right">{formatMinutes(op.tempoMedioMin)}</TableCell>
                    <TableCell className="text-right">
                      {op.unidades > 0 ? formatNumber(op.unidades) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Dados calculados a partir de full_orders.separado_em
      </p>
    </div>
  );
};

export default DashboardSeparacao;
