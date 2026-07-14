import { useMemo } from "react";
import { usePersistedMLOrders } from "@/hooks/useMLData";

export type MLDashboardMetrics = {
  totalOrders: number;
  grossRevenue: number;
  totalFees: number;
  totalShipping: number;
  netRevenue: number;
  margin: number;
  avgTicket: number;
  revenueTrend: number;
  statusCounts: Record<string, number>;
  shippingStatusCounts: Record<string, number>;
  topProducts: { title: string; qty: number; revenue: number }[];
  dailyData: { label: string; receita: number; comissao: number; frete: number }[];
};

export function useMLDashboardMetrics(periodDays: number) {
  const { data: persistedOrders, isLoading, isError } = usePersistedMLOrders();

  const metrics = useMemo<MLDashboardMetrics>(() => {
    const orders = (persistedOrders as any[]) ?? [];
    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
    const prevCutoff = new Date(Date.now() - periodDays * 2 * 24 * 60 * 60 * 1000).toISOString();

    const periodOrders = orders.filter((o) => o.date_created && o.date_created >= cutoff);
    const prevPeriodOrders = orders.filter(
      (o) => o.date_created && o.date_created >= prevCutoff && o.date_created < cutoff
    );

    const grossRevenue = periodOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const prevGrossRevenue = prevPeriodOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const totalFees = periodOrders.reduce((s, o) => s + Number(o.marketplace_fee || 0), 0);
    const totalShipping = periodOrders.reduce((s, o) => s + Number(o.shipping_cost || 0), 0);
    const netRevenue = grossRevenue - totalFees - totalShipping;
    const margin = grossRevenue > 0 ? (netRevenue / grossRevenue) * 100 : 0;
    const avgTicket = periodOrders.length > 0 ? grossRevenue / periodOrders.length : 0;
    const revenueTrend =
      prevGrossRevenue > 0
        ? Math.round(((grossRevenue - prevGrossRevenue) / prevGrossRevenue) * 100)
        : grossRevenue > 0
        ? 100
        : 0;

    const statusCounts: Record<string, number> = {};
    for (const o of periodOrders) {
      const s = o.status || "unknown";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    const shippingStatusCounts: Record<string, number> = {};
    for (const o of periodOrders) {
      const s = o.shipping_status || "unknown";
      shippingStatusCounts[s] = (shippingStatusCounts[s] || 0) + 1;
    }

    const productRevMap = new Map<string, { title: string; qty: number; revenue: number }>();
    for (const o of periodOrders) {
      for (const item of o.ml_order_items || []) {
        const key = item.ml_item_id;
        const existing = productRevMap.get(key);
        if (existing) {
          existing.qty += item.quantity;
          existing.revenue += Number(item.total_price || 0);
        } else {
          productRevMap.set(key, {
            title: item.ml_item_title || item.products?.name || key,
            qty: item.quantity,
            revenue: Number(item.total_price || 0),
          });
        }
      }
    }
    const topProducts = Array.from(productRevMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const dailyData: { label: string; receita: number; comissao: number; frete: number }[] = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const dayOrders = periodOrders.filter((o) => o.date_created?.startsWith(dateStr));
      dailyData.push({
        label,
        receita: dayOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0),
        comissao: dayOrders.reduce((s, o) => s + Number(o.marketplace_fee || 0), 0),
        frete: dayOrders.reduce((s, o) => s + Number(o.shipping_cost || 0), 0),
      });
    }

    return {
      totalOrders: periodOrders.length,
      grossRevenue,
      totalFees,
      totalShipping,
      netRevenue,
      margin,
      avgTicket,
      revenueTrend,
      statusCounts,
      shippingStatusCounts,
      topProducts,
      dailyData,
    };
  }, [persistedOrders, periodDays]);

  return { metrics, isLoading, isError };
}
