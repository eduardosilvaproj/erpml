import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export type PeriodFilter = "today" | "7d" | "14d" | "15d" | "30d" | "39d" | "6m" | "1a";

export type MLMetricsInput = {
  grossRevenue: number;
  totalFees: number;
  totalShipping: number;
  netRevenue: number;
  totalOrders: number;
};

function getDateRange(period: PeriodFilter) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const daysMap: Record<PeriodFilter, number> = {
    today: 0,
    "7d": 7,
    "14d": 14,
    "15d": 15,
    "30d": 30,
    "39d": 39,
    "6m": 180,
    "1a": 365,
  };

  const days = daysMap[period];
  const from = new Date(now);
  from.setDate(from.getDate() - (days || 1));
  const fromStr = days === 0 ? today : from.toISOString().split("T")[0];

  // Previous period for trend comparison
  const prevFrom = new Date(from);
  prevFrom.setDate(prevFrom.getDate() - (days || 1));
  const prevFromStr = prevFrom.toISOString().split("T")[0];

  return { from: fromStr, to: today, prevFrom: prevFromStr, prevTo: fromStr };
}

function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function useDashboardData(period: PeriodFilter, mlMetrics?: MLMetricsInput) {
  const companyId = useCompanyId();
  const { from, to, prevFrom, prevTo } = getDateRange(period);

  return useQuery({
    queryKey: ["dashboard-data", period, companyId, mlMetrics?.grossRevenue ?? 0],
    enabled: !!companyId,
    queryFn: async () => {
      // Fetch current period sales with items
      const { data: currentSales } = await supabase
        .from("sales")
        .select("id, total_value, created_at, customer_id, payment_method, sale_items(product_id, product_name, quantity, unit_price, total_price)")
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59")
        .eq("status", "finalizada")
        .eq("company_id", companyId as string);

      // Fetch previous period sales for trend
      const { data: prevSales } = await supabase
        .from("sales")
        .select("id, total_value, created_at, customer_id")
        .gte("created_at", prevFrom)
        .lt("created_at", from)
        .eq("status", "finalizada")
        .eq("company_id", companyId as string);

      // Fetch products for cost/margin calculation
      const { data: products } = await supabase
        .from("products")
        .select("id, name, cost, price, stock_physical, stock_full, min_stock, active")
        .eq("company_id", companyId as string);

      // Fetch customers
      const { data: customers } = await supabase
        .from("customers")
        .select("id, created_at")
        .eq("company_id", companyId as string);

      // Fetch pending full orders
      const { count: pendingFull } = await supabase
        .from('full_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId as string)
        .not('frete_ml', 'is', null)
        .neq('frete_ml', '')
        .in('status', ['pausado', 'separando', 'aguardando_carregamento']);

      // Fetch sent full orders
      const { count: sentFull } = await supabase
        .from('full_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId as string)
        .not('frete_ml', 'is', null)
        .neq('frete_ml', '')
        .eq('status', 'enviado');

      // Fetch transfer orders
      const { data: transfers } = await supabase
        .from("transfer_orders")
        .select("id, status, total_quantity")
        .eq("company_id", companyId as string);

      // Fetch overdue payments
      const { data: payments } = await supabase
        .from("invoice_payments")
        .select("id, status, due_date, amount, invoices!inner(company_id)")
        .eq("invoices.company_id", companyId as string);

      const sales = currentSales || [];
      const prev = prevSales || [];
      const prods = products || [];
      const custs = customers || [];
      const xfers = transfers || [];
      const pmts = (payments || []) as any[];

      // --- KPI Calculations ---

      // PDV Revenue
      const revenue = sales.reduce((s, sale) => s + Number(sale.total_value), 0);
      const prevRevenue = prev.reduce((s, sale) => s + Number(sale.total_value), 0);

      // ML Revenue (from mlMetrics parameter)
      const mlRevenue = mlMetrics?.grossRevenue ?? 0;
      const mlNetRevenue = mlMetrics?.netRevenue ?? 0;
      const mlFees = mlMetrics?.totalFees ?? 0;
      const mlShipping = mlMetrics?.totalShipping ?? 0;
      const mlOrders = mlMetrics?.totalOrders ?? 0;

      // Consolidated Revenue (PDV + ML)
      const consolidatedRevenue = revenue + mlRevenue;
      const prevConsolidatedRevenue = prevRevenue; // ML prev not available, use PDV only for trend

      // Total sales count (PDV + ML)
      const totalSales = sales.length + mlOrders;
      const prevTotalSales = prev.length;

      // Ticket médio
      const avgTicket = totalSales > 0 ? revenue / totalSales : 0;
      const prevAvgTicket = prevTotalSales > 0 ? prevRevenue / prevTotalSales : 0;

      // Cost & profit calculation
      const productCostMap = new Map(prods.map(p => [p.id, p.cost]));
      let totalCost = 0;
      const productSalesMap = new Map<string, { name: string; qty: number; revenue: number }>();

      for (const sale of sales) {
        const items = (sale as any).sale_items || [];
        for (const item of items) {
          const cost = productCostMap.get(item.product_id) || 0;
          totalCost += cost * item.quantity;

          const existing = productSalesMap.get(item.product_id);
          if (existing) {
            existing.qty += item.quantity;
            existing.revenue += Number(item.total_price);
          } else {
            productSalesMap.set(item.product_id, {
              name: item.product_name,
              qty: item.quantity,
              revenue: Number(item.total_price),
            });
          }
        }
      }

      const netProfit = (revenue + mlNetRevenue) - totalCost;
      const profitMargin = consolidatedRevenue > 0 ? (netProfit / consolidatedRevenue) * 100 : 0;

      // Top products ranking
      const topProducts = Array.from(productSalesMap.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      // New customers in period
      const newCustomers = custs.filter(c => c.created_at >= from).length;
      const prevNewCustomers = custs.filter(c => c.created_at >= prevFrom && c.created_at < from).length;

      // Pending shipments (ONLY full orders in specific statuses as requested)
      const pendingShipments = (pendingFull || 0);
      const sentShipments = (sentFull || 0) + xfers.filter(t => t.status === "enviado" || t.status === "recebido").length;

      // Stock alerts
      const lowStockProducts = prods.filter(p => 
        p.active && p.min_stock > 0 && (p.stock_physical + p.stock_full) <= p.min_stock
      );
      const outOfStockProducts = prods.filter(p => 
        p.active && (p.stock_physical + p.stock_full) === 0
      );

      // Overdue payments
      const today = new Date().toISOString().split("T")[0];
      const overduePayments = pmts.filter(p => 
        p.status === "pendente" && p.due_date && p.due_date < today
      );
      const overdueAmount = overduePayments.reduce((s, p) => s + Number(p.amount), 0);

      // Alerts
      const alerts: { type: "error" | "warning" | "info"; message: string }[] = [];
      if (outOfStockProducts.length > 0) {
        alerts.push({ type: "error", message: `${outOfStockProducts.length} produto(s) sem estoque` });
      }
      if (lowStockProducts.length > 0) {
        alerts.push({ type: "warning", message: `${lowStockProducts.length} produto(s) com estoque baixo` });
      }
      if (overduePayments.length > 0) {
        alerts.push({ type: "error", message: `${overduePayments.length} pagamento(s) vencido(s) — R$ ${overdueAmount.toFixed(2)}` });
      }
      if (pendingShipments > 0) {
        alerts.push({ type: "warning", message: `${pendingShipments} envio(s) pendente(s) de separação` });
      }

      return {
        revenue,
        revenueTrend: calcTrend(revenue, prevRevenue),
        consolidatedRevenue,
        consolidatedRevenueTrend: calcTrend(consolidatedRevenue, prevConsolidatedRevenue),
        mlRevenue,
        mlNetRevenue,
        mlFees,
        mlShipping,
        mlOrders,
        totalSales,
        salesTrend: calcTrend(totalSales, prevTotalSales),
        netProfit,
        profitMargin,
        avgTicket,
        avgTicketTrend: calcTrend(avgTicket, prevAvgTicket),
        pendingShipments,
        sentShipments,
        newCustomers,
        newCustomersTrend: calcTrend(newCustomers, prevNewCustomers),
        topProducts,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        alerts,
        totalProducts: prods.filter(p => p.active).length,
        totalCustomers: custs.length,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
