import { ShoppingBag, Package, AlertTriangle, Warehouse, TrendingUp, DollarSign, BarChart3, Percent, Truck, ArrowDownRight, ArrowUpRight, Award, Zap, FileDown, FileSpreadsheet, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateMLReportPDF } from "@/lib/ml-report-pdf";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useProducts } from "@/hooks/useProductData";
import { useSalesStats, useSales } from "@/hooks/useSalesData";
import { useInvoiceStats } from "@/hooks/useInvoiceData";
import { useTransferOrders } from "@/hooks/useTransferData";
import { useMLConnection, useMLItems, useMLLinkedProducts, useMLOrders, usePersistedMLOrders } from "@/hooks/useMLData";
import { useInvoicesWithPayments } from "@/hooks/useFinanceiroData";
import { useMyCompany } from "@/hooks/useCompanyData";
import { useToast } from "@/hooks/use-toast";
import { useFinancialMetrics } from "@/hooks/useFinancialMetrics";
import { formatCurrency } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from "recharts";
import { useMemo, useState } from "react";

type PeriodKey = "7d" | "14d" | "15d" | "30d" | "39d" | "6m" | "1a";
const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "14d", label: "14 dias", days: 14 },
  { key: "15d", label: "15 dias", days: 15 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "39d", label: "39 dias", days: 39 },
  { key: "6m", label: "6 meses", days: 180 },
  { key: "1a", label: "1 ano", days: 365 },
];

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

const PainelHub = () => {
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const { toast } = useToast();
  const selectedPeriod = PERIOD_OPTIONS.find((p) => p.key === period)!;

  const { data: productData } = useProducts({ pageSize: 999 });
  const { data: salesStats } = useSalesStats();
  const { data: recentSales } = useSales({ limit: 5 });
  const dateFrom = new Date(Date.now() - selectedPeriod.days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: allSalesData } = useSales({ dateFrom });
  const { data: invoiceStats } = useInvoiceStats();
  const { data: transfers } = useTransferOrders();
  const { data: mlConnection } = useMLConnection();
  const { data: myCompany } = useMyCompany();
  const mlEnabled = !!mlConnection && !mlConnection.needs_reauth;
  const { data: mlItems } = useMLItems(mlEnabled);
  const { data: mlOrders } = useMLOrders(mlEnabled);
  const { data: mlLinked } = useMLLinkedProducts();
  const { data: invoicesWithPayments } = useInvoicesWithPayments();
  const { data: persistedOrders } = usePersistedMLOrders();

  const products = productData?.products || [];
  const totalPhysical = products.reduce((s, p) => s + p.stock_physical, 0);
  const totalFull = products.reduce((s, p) => s + p.stock_full, 0);
  const lowStock = products.filter((p) => p.min_stock > 0 && (p.stock_physical + p.stock_full) <= p.min_stock);
  const pendingTransfers = transfers?.filter((t) => t.status !== "conferido_full" && t.status !== "cancelado") || [];

  const salesChartData = useMemo(() => {
    const days: { date: string; label: string; vendas: number; faturamento: number }[] = [];
    for (let i = selectedPeriod.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const daySales = allSalesData?.filter((s: any) => s.created_at.startsWith(dateStr)) || [];
      days.push({
        date: dateStr,
        label,
        vendas: daySales.length,
        faturamento: daySales.reduce((sum: number, s: any) => sum + Number(s.total_value), 0),
      });
    }
    return days;
  }, [allSalesData, selectedPeriod.days]);

  const financialMetrics = useMemo(() => {
    if (!invoicesWithPayments) return { totalPendente: 0, totalPago: 0, totalVencido: 0, contasPendentes: 0 };
    const today = new Date().toISOString().split("T")[0];
    let totalPendente = 0, totalPago = 0, totalVencido = 0, contasPendentes = 0;
    for (const inv of invoicesWithPayments) {
      for (const p of (inv as any).invoice_payments || []) {
        if (p.status === "pago") {
          totalPago += Number(p.amount);
        } else {
          totalPendente += Number(p.amount);
          contasPendentes++;
          if (p.due_date && p.due_date < today) {
            totalVencido += Number(p.amount);
          }
        }
      }
    }
    return { totalPendente, totalPago, totalVencido, contasPendentes };
  }, [invoicesWithPayments]);

  const stockDivergence = useMemo(() => {
    return products
      .map((p) => ({
        name: p.name.length > 20 ? p.name.slice(0, 20) + "…" : p.name,
        fisico: p.stock_physical,
        full: p.stock_full,
        diff: Math.abs(p.stock_physical - p.stock_full),
      }))
      .filter((p) => p.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 8);
  }, [products]);

  const paymentPieData = useMemo(() => {
    const { totalPago, totalPendente, totalVencido } = financialMetrics;
    const pendenteSemVencido = totalPendente - totalVencido;
    const data = [];
    if (totalPago > 0) data.push({ name: "Pago", value: totalPago });
    if (pendenteSemVencido > 0) data.push({ name: "Pendente", value: pendenteSemVencido });
    if (totalVencido > 0) data.push({ name: "Vencido", value: totalVencido });
    return data;
  }, [financialMetrics]);

  const alerts: { message: string; type: "warning" | "error" }[] = [];
  lowStock.forEach((p) => alerts.push({ message: `${p.name} — estoque baixo (${p.stock_physical + p.stock_full}/${p.min_stock})`, type: "warning" }));
  if (invoiceStats && invoiceStats.divergente > 0) {
    alerts.push({ message: `${invoiceStats.divergente} nota(s) divergente(s)`, type: "error" });
  }
  if (invoiceStats && invoiceStats.aguardando > 0) {
    alerts.push({ message: `${invoiceStats.aguardando} nota(s) aguardando conferência`, type: "warning" });
  }
  if (financialMetrics.totalVencido > 0) {
    alerts.push({ message: `${formatCurrency(financialMetrics.totalVencido)} em pagamentos vencidos`, type: "error" });
  }

  // ML data computed
  const mlComputed = useMemo(() => {
    const orders = persistedOrders ?? [];
    const periodDays = selectedPeriod.days;
    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
    const prevCutoff = new Date(Date.now() - periodDays * 2 * 24 * 60 * 60 * 1000).toISOString();

    const periodOrders = orders.filter((o: any) => o.date_created && o.date_created >= cutoff);
    const prevPeriodOrders = orders.filter((o: any) => o.date_created && o.date_created >= prevCutoff && o.date_created < cutoff);

    const grossRevenue = periodOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
    const prevGrossRevenue = prevPeriodOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
    const totalFees = periodOrders.reduce((s: number, o: any) => s + Number(o.marketplace_fee || 0), 0);
    const totalShipping = periodOrders.reduce((s: number, o: any) => s + Number(o.shipping_cost || 0), 0);
    const netRevenue = grossRevenue - totalFees - totalShipping;
    const margin = grossRevenue > 0 ? (netRevenue / grossRevenue) * 100 : 0;
    const avgTicketML = periodOrders.length > 0 ? grossRevenue / periodOrders.length : 0;
    const revenueTrend = prevGrossRevenue > 0 ? Math.round(((grossRevenue - prevGrossRevenue) / prevGrossRevenue) * 100) : (grossRevenue > 0 ? 100 : 0);

    const statusCounts: Record<string, number> = {};
    for (const o of periodOrders) { const s = (o as any).status || "unknown"; statusCounts[s] = (statusCounts[s] || 0) + 1; }
    const shippingStatusCounts: Record<string, number> = {};
    for (const o of periodOrders) { const s = (o as any).shipping_status || "unknown"; shippingStatusCounts[s] = (shippingStatusCounts[s] || 0) + 1; }

    const productRevMap = new Map<string, { title: string; qty: number; revenue: number }>();
    for (const o of periodOrders) {
      for (const item of ((o as any).ml_order_items || [])) {
        const key = item.ml_item_id;
        const existing = productRevMap.get(key);
        if (existing) { existing.qty += item.quantity; existing.revenue += Number(item.total_price || 0); }
        else { productRevMap.set(key, { title: item.ml_item_title || item.products?.name || key, qty: item.quantity, revenue: Number(item.total_price || 0) }); }
      }
    }
    const topMLProducts = Array.from(productRevMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    const dailyData: { label: string; receita: number; comissao: number; frete: number }[] = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const dayOrders = periodOrders.filter((o: any) => o.date_created?.startsWith(dateStr));
      dailyData.push({
        label,
        receita: dayOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0),
        comissao: dayOrders.reduce((s: number, o: any) => s + Number(o.marketplace_fee || 0), 0),
        frete: dayOrders.reduce((s: number, o: any) => s + Number(o.shipping_cost || 0), 0),
      });
    }

    const feePieData = [
      { name: "Líquido", value: Math.max(netRevenue, 0) },
      { name: "Comissão ML", value: totalFees },
      { name: "Frete", value: totalShipping },
    ].filter(d => d.value > 0);

    return { periodOrders, grossRevenue, totalFees, totalShipping, netRevenue, margin, avgTicketML, revenueTrend, statusCounts, shippingStatusCounts, topMLProducts, dailyData, feePieData, periodDays };
  }, [persistedOrders, selectedPeriod.days]);

  const TrendIcon = ({ value }: { value: number }) =>
    value >= 0
      ? <span className="flex items-center text-xs text-primary"><ArrowUpRight className="h-3 w-3" />{value}%</span>
      : <span className="flex items-center text-xs text-destructive"><ArrowDownRight className="h-3 w-3" />{Math.abs(value)}%</span>;

  const handleExportExcel = () => {
    const headers = ["Métrica", "Valor"];
    const rows = [
      ["Vendas Hoje", String(salesStats?.salesToday ?? 0)],
      ["Faturamento Hoje", formatCurrency(salesStats?.revenueToday ?? 0)],
      ["Faturamento 30d", formatCurrency(salesStats?.revenue30d ?? 0)],
      ["Produtos", String(products.length)],
      ["Estoque Físico", String(totalPhysical)],
      ["Estoque FULL", String(totalFull)],
      ["Estoque Baixo", String(lowStock.length)],
      ["Financeiro Pago", formatCurrency(financialMetrics.totalPago)],
      ["Financeiro Pendente", formatCurrency(financialMetrics.totalPendente)],
      ["Financeiro Vencido", formatCurrency(financialMetrics.totalVencido)],
      ["ML Receita Bruta", formatCurrency(mlComputed.grossRevenue)],
      ["ML Comissão", formatCurrency(mlComputed.totalFees)],
      ["ML Frete", formatCurrency(mlComputed.totalShipping)],
      ["ML Lucro Líquido", formatCurrency(mlComputed.netRevenue)],
    ];
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `painel_hub_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Relatório exportado em Excel/CSV!" });
  };

  const handleExportPDF = () => {
    generateMLReportPDF({
      periodLabel: selectedPeriod.label,
      periodDays: mlComputed.periodDays,
      grossRevenue: mlComputed.grossRevenue,
      totalFees: mlComputed.totalFees,
      totalShipping: mlComputed.totalShipping,
      netRevenue: mlComputed.netRevenue,
      margin: mlComputed.margin,
      avgTicket: mlComputed.avgTicketML,
      totalOrders: mlComputed.periodOrders.length,
      revenueTrend: mlComputed.revenueTrend,
      topProducts: mlComputed.topMLProducts,
      statusCounts: mlComputed.statusCounts,
      shippingStatusCounts: mlComputed.shippingStatusCounts,
      dailyData: mlComputed.dailyData,
      companyName: myCompany?.name,
    });
  };

  // ---- SECTIONS ----

  const KPIsSection = (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {[
        { label: "Vendas Hoje", value: salesStats?.salesToday ?? 0, icon: ShoppingBag },
        { label: "Faturamento Hoje", value: formatCurrency(salesStats?.revenueToday ?? 0), icon: DollarSign },
        { label: "Faturamento 30d", value: formatCurrency(salesStats?.revenue30d ?? 0), icon: TrendingUp },
        { label: "Produtos", value: products.length, icon: Package },
      ].map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-xl font-bold mt-1">{item.value}</p>
              </div>
              <item.icon className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const SalesSection = (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Vendas — Últimos {selectedPeriod.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salesChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" fontSize={12} className="fill-muted-foreground" />
              <YAxis fontSize={12} className="fill-muted-foreground" />
              <Tooltip
                formatter={(value: number, name: string) => name === "faturamento" ? formatCurrency(value) : value}
                labelFormatter={(l) => `Data: ${l}`}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Bar dataKey="vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Vendas" />
              <Bar dataKey="faturamento" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Faturamento" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {recentSales && recentSales.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" /> Últimas Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-xs">{sale.sale_number}</TableCell>
                      <TableCell>{sale.customers?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{sale.payment_method}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(sale.total_value)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(sale.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const FinanceSection = (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <p className="text-xs text-muted-foreground">Pago</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(financialMetrics.totalPago)}</p>
            </div>
            <div className="p-3 rounded-lg bg-destructive/10">
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(financialMetrics.totalPendente)}</p>
            </div>
            <div className="p-3 rounded-lg bg-destructive/10">
              <p className="text-xs text-muted-foreground">Vencido</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(financialMetrics.totalVencido)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Contas Pendentes</p>
              <p className="text-lg font-bold">{financialMetrics.contasPendentes}</p>
            </div>
          </div>
          {paymentPieData.length > 0 && (
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={paymentPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={3}>
                  {paymentPieData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend fontSize={12} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const StockSection = (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Produtos</p><p className="text-2xl font-bold">{products.length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Físico</p><p className="text-2xl font-bold text-primary">{totalPhysical}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">FULL</p><p className="text-2xl font-bold">{totalFull}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{totalPhysical + totalFull}</p></CardContent></Card>
      </div>

      {stockDivergence.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Divergências Físico × FULL ({stockDivergence.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stockDivergence} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" fontSize={12} className="fill-muted-foreground" />
                <YAxis dataKey="name" type="category" width={100} fontSize={11} className="fill-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="fisico" fill="hsl(var(--primary))" name="Físico" radius={[0, 4, 4, 0]} />
                <Bar dataKey="full" fill="hsl(var(--accent))" name="FULL" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {pendingTransfers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Transferências Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTransfers.slice(0, 5).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.order_number}</TableCell>
                      <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                      <TableCell className="text-center">{t.total_quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const MLSection = (
    <div className="space-y-4">
      {/* ML KPIs */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Receita Bruta</p><p className="text-lg font-bold text-primary">{formatCurrency(mlComputed.grossRevenue)}</p><TrendIcon value={mlComputed.revenueTrend} /></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Comissão ML</p><p className="text-lg font-bold text-destructive">{formatCurrency(mlComputed.totalFees)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Frete</p><p className="text-lg font-bold">{formatCurrency(mlComputed.totalShipping)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Lucro Líquido</p><p className={`text-lg font-bold ${mlComputed.netRevenue >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(mlComputed.netRevenue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Margem</p><p className="text-lg font-bold">{mlComputed.margin.toFixed(1)}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ticket Médio</p><p className="text-lg font-bold">{formatCurrency(mlComputed.avgTicketML)}</p><p className="text-xs text-muted-foreground">{mlComputed.periodOrders.length} pedidos</p></CardContent></Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Receita ML por Dia</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mlComputed.dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" fontSize={12} className="fill-muted-foreground" />
                <YAxis fontSize={12} className="fill-muted-foreground" />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="receita" fill="hsl(var(--primary))" name="Receita" radius={[4, 4, 0, 0]} />
                <Bar dataKey="comissao" fill="hsl(var(--destructive))" name="Comissão" radius={[4, 4, 0, 0]} />
                <Bar dataKey="frete" fill="hsl(var(--muted-foreground))" name="Frete" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Percent className="h-4 w-4" /> Composição da Receita</CardTitle></CardHeader>
          <CardContent>
            {mlComputed.feePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={mlComputed.feePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {mlComputed.feePieData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">Sem dados no período</p>
            )}
          </CardContent>
        </Card>
      </div>

      {mlComputed.topMLProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" /> Performance por Produto ML</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-right"><span className="flex items-center justify-end gap-1"><Zap className="h-3 w-3" />Veloc./dia</span></TableHead>
                    <TableHead className="text-right">% Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mlComputed.topMLProducts.map((p, i) => {
                    const avgTicket = p.qty > 0 ? p.revenue / p.qty : 0;
                    const velocity = mlComputed.periodDays > 0 ? p.qty / mlComputed.periodDays : 0;
                    const revenueShare = mlComputed.grossRevenue > 0 ? (p.revenue / mlComputed.grossRevenue) * 100 : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell><span className={`text-xs font-bold ${i === 0 ? "text-yellow-500" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>{i + 1}</span></TableCell>
                        <TableCell className="max-w-[200px]"><span className="text-sm truncate block">{p.title.length > 50 ? p.title.slice(0, 50) + "…" : p.title}</span></TableCell>
                        <TableCell className="text-right font-bold text-primary">{formatCurrency(p.revenue)}</TableCell>
                        <TableCell className="text-right">{p.qty}</TableCell>
                        <TableCell className="text-right">{formatCurrency(avgTicket)}</TableCell>
                        <TableCell className="text-right"><span className={`font-medium ${velocity >= 1 ? "text-primary" : "text-muted-foreground"}`}>{velocity.toFixed(1)}</span></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(revenueShare, 100)}%` }} /></div>
                            <span className="text-xs w-10 text-right">{revenueShare.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> Status dos Pedidos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(mlComputed.statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <Badge variant="outline" className="text-xs">{status}</Badge>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
          {Object.keys(mlComputed.shippingStatusCounts).length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">Envios</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(mlComputed.shippingStatusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-xs">{status}</span>
                    <span className="font-bold text-sm">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Conta", value: mlConnection ? (mlConnection.needs_reauth ? "Reconectar" : "Conectada") : "Desconectada" },
          { label: "Pedidos ML", value: mlOrders?.paging?.total ?? 0 },
          { label: "Anúncios ML", value: mlItems?.total ?? 0 },
          { label: "Vinculados", value: mlLinked?.length ?? 0 },
        ].map((item) => (
          <Card key={item.label}><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">{item.label}</p><p className="text-2xl font-bold">{item.value}</p></CardContent></Card>
        ))}
      </div>
    </div>
  );

  const AlertsSection = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Alertas ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-lg p-3 ${alert.type === "error" ? "bg-destructive/5 border border-destructive/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
                <AlertTriangle className={`h-4 w-4 shrink-0 ${alert.type === "error" ? "text-destructive" : "text-amber-600"}`} />
                <p className="text-sm">{alert.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">Nenhum alerta no momento ✓</p>
        )}
      </CardContent>
    </Card>
  );

  const { data: financialMetricsData, isLoading: loadingFinancial } = useFinancialMetrics(selectedPeriod.days);

  const ResultadoSection = useMemo(() => {
    if (loadingFinancial || !financialMetricsData) {
      return (
        <div className="flex justify-center py-12">
          <p className="text-muted-foreground">Carregando métricas financeiras...</p>
        </div>
      );
    }

    const {
      grossRevenue, pdvDiscounts, mlFees, mlShipping, totalDeductions,
      netRevenue, cmv, contributionMargin, pdvSalesCount, mlOrdersCount, salesDetail,
    } = financialMetricsData;

    const summaryCards = [
      { label: "Faturamento Bruto", value: formatCurrency(grossRevenue), color: "text-primary" },
      { label: "Descontos/Taxas", value: formatCurrency(totalDeductions), color: "text-destructive" },
      { label: "Faturamento Líquido", value: formatCurrency(netRevenue), color: netRevenue >= 0 ? "text-primary" : "text-destructive" },
      { label: "CMV", value: formatCurrency(cmv), color: "text-muted-foreground" },
      { label: "Margem", value: `${contributionMargin.toFixed(1)}%`, color: contributionMargin >= 0 ? "text-emerald-600" : "text-destructive" },
    ];

    return (
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          {summaryCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className={`text-lg font-bold mt-1 ${card.color}`}>{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Detalhamento de Vendas ({pdvSalesCount + mlOrdersCount} registros)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor Bruto</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesDetail.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nenhuma venda no período
                      </TableCell>
                    </TableRow>
                  ) : (
                    salesDetail.slice(0, 50).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.type === "PDV" ? "default" : "secondary"}>
                            {item.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.productName}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.grossValue)}</TableCell>
                        <TableCell className="text-right text-destructive">
                          {item.discount > 0 ? formatCurrency(item.discount) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.netValue)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(item.cost)}</TableCell>
                        <TableCell className="text-right">
                          <span className={item.marginPercent >= 0 ? "text-emerald-600" : "text-destructive"}>
                            {item.marginPercent.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }, [financialMetricsData, loadingFinancial]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Painel HUB</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral de vendas, estoque e financeiro</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-xl border border-border/60 p-1 bg-secondary/50 shadow-premium-xs">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all duration-200 ${
                  period === opt.key
                    ? "bg-primary text-primary-foreground shadow-primary-glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <FileDown className="h-4 w-4" />
                Exportar
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2">
                <FileDown className="h-4 w-4" />
                📄 Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                📊 Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="ml">Mercado Livre</TabsTrigger>
          <TabsTrigger value="resultado">Resultado</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6 mt-4">
          {KPIsSection}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {SalesSection}
            {FinanceSection}
          </div>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {StockSection}
          </div>
          {AlertsSection}
        </TabsContent>

        <TabsContent value="vendas" className="space-y-6 mt-4">
          {KPIsSection}
          {SalesSection}
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-6 mt-4">
          {FinanceSection}
        </TabsContent>

        <TabsContent value="estoque" className="space-y-6 mt-4">
          {StockSection}
        </TabsContent>

        <TabsContent value="ml" className="space-y-6 mt-4">
          {MLSection}
        </TabsContent>

        <TabsContent value="resultado" className="space-y-6 mt-4">
          {ResultadoSection}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PainelHub;
