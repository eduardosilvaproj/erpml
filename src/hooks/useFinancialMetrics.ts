import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface FinancialMetrics {
  /** Faturamento Bruto (PDV + ML) */
  grossRevenue: number;
  /** Descontos PDV */
  pdvDiscounts: number;
  /** Taxas ML (marketplace_fee) */
  mlFees: number;
  /** Custos de frete ML */
  mlShipping: number;
  /** Total de descontos/taxas */
  totalDeductions: number;
  /** Faturamento Líquido (Bruto - Deduções) */
  netRevenue: number;
  /** CMV — Custo das Mercadorias Vendidas */
  cmv: number;
  /** Margem de Contribuição (%) */
  contributionMargin: number;
  /** Total de vendas PDV */
  pdvSalesCount: number;
  /** Total de pedidos ML */
  mlOrdersCount: number;
  /** Vendas detalhadas para tabela */
  salesDetail: SalesDetailItem[];
}

export interface SalesDetailItem {
  id: string;
  date: string;
  type: "PDV" | "ML";
  productName: string;
  quantity: number;
  grossValue: number;
  discount: number;
  netValue: number;
  cost: number;
  marginPercent: number;
}

function getDateRange(days: number) {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from: from.toISOString().split("T")[0], to };
}

export function useFinancialMetrics(days: number) {
  const companyId = useCompanyId();
  const { from, to } = getDateRange(days);

  return useQuery({
    queryKey: ["financial-metrics", days, companyId],
    enabled: !!companyId,
    refetchInterval: 60_000,
    queryFn: async () => {
      // --- PDV Sales with items ---
      const { data: pdvSales } = await supabase
        .from("sales")
        .select("id, total_value, discount, created_at, sale_items(product_id, quantity, total_price)")
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59")
        .eq("status", "finalizada")
        .eq("company_id", companyId as string);

      // --- ML Orders with items ---
      const { data: mlOrders } = await supabase
        .from("ml_orders")
        .select("id, total_amount, marketplace_fee, shipping_cost, date_created, ml_order_items(product_id, quantity, total_price)")
        .gte("date_created", from)
        .lte("date_created", to + "T23:59:59")
        .eq("company_id", companyId as string);

      // --- Products for cost ---
      const { data: products } = await supabase
        .from("products")
        .select("id, cost")
        .eq("company_id", companyId as string);

      const productCostMap = new Map<string, number>();
      for (const p of products || []) {
        productCostMap.set(p.id, Number(p.cost) || 0);
      }

      // --- PDV Calculations ---
      const pdvList = pdvSales || [];
      const pdvGrossRevenue = pdvList.reduce((s, sale) => s + Number(sale.total_value), 0);
      const pdvDiscounts = pdvList.reduce((s, sale) => s + Number(sale.discount || 0), 0);

      // --- ML Calculations ---
      const mlList = mlOrders || [];
      const mlGrossRevenue = mlList.reduce((s, o) => s + Number(o.total_amount || 0), 0);
      const mlFees = mlList.reduce((s, o) => s + Number(o.marketplace_fee || 0), 0);
      const mlShipping = mlList.reduce((s, o) => s + Number(o.shipping_cost || 0), 0);

      // --- Consolidated ---
      const grossRevenue = pdvGrossRevenue + mlGrossRevenue;
      const totalDeductions = pdvDiscounts + mlFees + mlShipping;
      const netRevenue = grossRevenue - totalDeductions;

      // --- CMV ---
      let cmv = 0;
      for (const sale of pdvList) {
        const items = (sale as any).sale_items || [];
        for (const item of items) {
          const cost = productCostMap.get(item.product_id) || 0;
          cmv += cost * item.quantity;
        }
      }
      for (const order of mlList) {
        const items = (order as any).ml_order_items || [];
        for (const item of items) {
          const cost = productCostMap.get(item.product_id) || 0;
          cmv += cost * item.quantity;
        }
      }

      const contributionMargin = netRevenue > 0
        ? ((netRevenue - cmv) / netRevenue) * 100
        : 0;

      // --- Sales Detail (for table) ---
      const salesDetail: SalesDetailItem[] = [];

      for (const sale of pdvList) {
        const items = (sale as any).sale_items || [];
        for (const item of items) {
          const cost = productCostMap.get(item.product_id) || 0;
          const itemGross = Number(item.total_price || 0);
          const itemDiscount = (sale.discount || 0) * (itemGross / (sale.total_value > 0 ? Number(sale.total_value) : 1));
          const itemNet = itemGross - itemDiscount;
          const itemCost = cost * item.quantity;
          salesDetail.push({
            id: sale.id + "-pdv-" + item.product_id,
            date: sale.created_at,
            type: "PDV",
            productName: item.product_name || "Produto",
            quantity: item.quantity,
            grossValue: itemGross,
            discount: itemDiscount,
            netValue: itemNet,
            cost: itemCost,
            marginPercent: itemNet > 0 ? ((itemNet - itemCost) / itemNet) * 100 : 0,
          });
        }
      }

      for (const order of mlList) {
        const items = (order as any).ml_order_items || [];
        for (const item of items) {
          const cost = productCostMap.get(item.product_id) || 0;
          const itemGross = Number(item.total_price || 0);
          const itemNet = itemGross;
          const itemCost = cost * item.quantity;
          salesDetail.push({
            id: order.id + "-ml-" + item.product_id,
            date: order.date_created,
            type: "ML",
            productName: item.ml_item_title || item.products?.name || "Produto ML",
            quantity: item.quantity,
            grossValue: itemGross,
            discount: 0,
            netValue: itemNet,
            cost: itemCost,
            marginPercent: itemNet > 0 ? ((itemNet - itemCost) / itemNet) * 100 : 0,
          });
        }
      }

      // Sort by date descending
      salesDetail.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        grossRevenue,
        pdvDiscounts,
        mlFees,
        mlShipping,
        totalDeductions,
        netRevenue,
        cmv,
        contributionMargin,
        pdvSalesCount: pdvList.length,
        mlOrdersCount: mlList.length,
        salesDetail,
      } satisfies FinancialMetrics;
    },
    staleTime: 30_000,
  });
}
