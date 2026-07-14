import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Users, DollarSign, Wallet, Calendar, PieChart as PieIcon } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area
} from 'recharts';

export const FinanceDashboard = () => {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["governance-finance-metrics-advanced"],
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("*, plans(name)");
      
      if (error) throw error;

      const { data: history, error: historyError } = await supabase
        .from("subscription_events")
        .select("*")
        .order("created_at", { ascending: true });

      if (historyError) throw historyError;

      const active = subs?.filter(s => s.status === "active" || s.status === "CONFIRMED") || [];
      const mrr = active.reduce((acc, s) => acc + Number(s.value || 0), 0);
      const arr = mrr * 12;
      const arpa = active.length > 0 ? mrr / active.length : 0;
      
      const churn = subs?.filter(s => s.status === "cancelled").length || 0;
      const overdue = subs?.filter(s => s.status === "overdue" || s.status === "PENDING").length || 0;
      
      // Estimated LTV (MRR / Churn Rate) - simplified
      const churnRate = (churn / (subs?.length || 1));
      const ltv = churnRate > 0 ? arpa / churnRate : arpa * 12; // 1 year if no churn

      // Group by plan
      const planDist = active.reduce((acc: any, s: any) => {
        const name = s.plans?.name || "Desconhecido";
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});

      const chartData = Object.entries(planDist).map(([name, value]) => ({ name, value }));

      // Revenue over time (simplified from events)
      const monthlyRevenue: any = {};
      history?.forEach((event: any) => {
        if (event.event_type === "PAYMENT_CONFIRMED" || event.event_type === "PAYMENT_RECEIVED") {
          const month = new Date(event.created_at).toLocaleString('pt-BR', { month: 'short' });
          monthlyRevenue[month] = (monthlyRevenue[month] || 0) + Number(event.amount || 0);
        }
      });

      const revenueChartData = Object.entries(monthlyRevenue).map(([name, value]) => ({ name, value }));

      return {
        mrr,
        arr,
        arpa,
        ltv,
        activeCount: active.length,
        overdueCount: overdue,
        churnRate: churnRate * 100,
        chartData,
        revenueChartData
      };
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ARR (Anualizado)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              {formatCurrency(metrics?.arr || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Estimativa anual baseada no MRR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ARPA (Ticket Médio)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-emerald-500" />
              {formatCurrency(metrics?.arpa || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Receita média por conta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">LTV Estimado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-500" />
              {formatCurrency(metrics?.ltv || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-blue-600 font-medium">Valor vitalício do cliente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inadimplência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2 text-amber-600">
              <Wallet className="h-6 w-6" />
              {metrics?.overdueCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando pagamento</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Crescimento de Receita</CardTitle>
            <CardDescription>Evolução mensal dos pagamentos confirmados</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.revenueChartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Composição da Base</CardTitle>
            <CardDescription>Assinaturas por plano</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics?.chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {metrics?.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">MRR Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(metrics?.mrr || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Churn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-500">{metrics?.churnRate.toFixed(2)}%</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
