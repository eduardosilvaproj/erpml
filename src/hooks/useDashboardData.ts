import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export type PeriodFilter = "today" | "7d" | "15d" | "30d";

function getDateRange(period: PeriodFilter) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const daysMap: Record<PeriodFilter, number> = {
    today: 0,
    "7d": 7,
    "15d": 15,
    "30d": 30,
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

export function useDashboardData(period: PeriodFilter) {
  const companyId = useCompanyId();
  const { from, to, prevFrom, prevTo } = getDateRange(period);

  return useQuery({
    queryKey: ["dashboard-data", period, companyId],
    enabled: !!companyId,
    queryFn: async () => {
      // Fetch current period sales with items
      const { data: currentSales } = await supabase
        .from("sales")
        .select("id, total_value, created_at, customer_id, payment_method, sale_items(product_id, product_name, quantity, unit_price, total_price)")
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59")
        .eq("status", "finalizada")
        .eq("company_id", companyId);

      // Fetch previous period sales for trend
      const { data: prevSales } = await supabase
        .from("sales")
        .select("id, total_value, created_at, customer_id")
        .gte("created_at", prevFrom)
        .lt("created_at", from)
        .eq("status", "finalizada")
        .eq("company_id", companyId);

      // Fetch products for cost/margin calculation
      const { data: products } = await supabase
        .from("products")
        .select("id, name, cost, price, stock_physical, stock_full, min_stock, active")
        .eq("company_id", companyId);

      // Fetch customers
      const { data: customers } = await supabase
        .from("customers")
        .select("id, created_at")
        .eq("company_id", companyId);

      // Fetch pending full orders
      const { count: pendingFull } = await supabase
        .from('full_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('status', ['pausado', 'separando', 'aguardando_carregamento']);

      // Fetch sent full orders
      const { count: sentFull } = await supabase
        .from('full_orders')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'enviado');

      // Fetch transfer orders
      const { data: transfers } = await supabase
        .from("transfer_orders")
        .select("id, status, total_quantity")
        .eq("company_id", companyId);

      // Fetch overdue payments
      const { data: payments } = await supabase
        .from("invoice_payments")
        .select("id, status, due_date, amount")
        .eq("company_id", companyId);

      const sales = currentSales || [];
      const prev = prevSales || [];
      const prods = products || [];
      const custs = customers || [];
      const xfers = transfers || [];
      const pmts = payments || [];

      // --- KPI Calculations ---

      // Revenue
      const revenue = sales.reduce((s, sale) => s + Number(sale.total_value), 0);
      const prevRevenue = prev.reduce((s, sale) => s + Number(sale.total_value), 0);

      // Total sales count
      const totalSales = sales.length;
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

      const netProfit = revenue - totalCost;
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      // Top products ranking
      const topProducts = Array.from(productSalesMap.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      // New customers in period
      const newCustomers = custs.filter(c => c.created_at >= from).length;
      const prevNewCustomers = custs.filter(c => c.created_at >= prevFrom && c.created_at < from).length;

      // Pending shipments (full orders in specific statuses + transfer orders in "separando" status)
      const pendingShipments = (pendingFull || 0) + xfers.filter(t => t.status === "separando").length;
      const sentShipments = xfers.filter(t => t.status === "enviado" || t.status === "recebido").length;

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
  });
}
