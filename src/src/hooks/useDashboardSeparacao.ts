import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface DashboardFilters {
  dateFrom: string;
  dateTo: string;
  operadorId?: string | null;
  status?: string[] | null;
}

export interface OperadorRanking {
  id: string | null;
  nome: string;
  pedidos: number;
  unidades: number;
  tempoMedioMin: number;
}

export interface SeparacaoPorDia {
  date: string;
  label: string;
  pedidos: number;
  unidades: number;
}

export interface StatusAtivo {
  status: string;
  count: number;
}

export interface DashboardData {
  totalSeparados: number;
  tempoMedioMin: number;
  totalUnidades: number;
  throughput: number;
  slaCumpridoPct: number;
  separacoesPorDia: SeparacaoPorDia[];
  rankingOperadores: OperadorRanking[];
  statusAtivos: StatusAtivo[];
  ordensDetalhadas: any[];
}

const STATUS_FINALIZADOS = [
  "separada",
  "aguardando_carregamento",
  "carregando",
  "enviado",
  "concluida",
];

const STATUS_ATIVOS = [
  "em_separacao",
  "pausado",
  "aguardando_carregamento",
  "carregando",
];

function formatLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function fillMissingDays(
  from: string,
  to: string,
  byDate: Record<string, { pedidos: number; unidades: number }>
): SeparacaoPorDia[] {
  const result: SeparacaoPorDia[] = [];
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const data = byDate[dateStr] || { pedidos: 0, unidades: 0 };
    result.push({
      date: dateStr,
      label: formatLabel(dateStr),
      pedidos: data.pedidos,
      unidades: data.unidades,
    });
  }
  return result;
}

export function useDashboardSeparacao(filters: DashboardFilters) {
  const companyId = useCompanyId();

  const ordensQuery = useQuery({
    queryKey: ["dashboard-separacao-ordens", companyId, filters],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("full_orders")
        .select(
          "id, frete_ml, status, separado_em, separado_por, created_at, previsao_carregamento, profiles:profiles!full_orders_separado_por_profiles_fkey(full_name)"
        )
        .eq("company_id", companyId as string)
        .in("status", STATUS_FINALIZADOS)
        .gte("separado_em", filters.dateFrom)
        .lte("separado_em", filters.dateTo)
        .order("separado_em", { ascending: false });

      if (filters.operadorId) {
        q = q.eq("separado_por", filters.operadorId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const statusAtivosQuery = useQuery({
    queryKey: ["dashboard-separacao-status-ativos", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("full_orders")
        .select("status")
        .eq("company_id", companyId as string)
        .in("status", STATUS_ATIVOS);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.status] = (counts[row.status] || 0) + 1;
      }
      return Object.entries(counts).map(([status, count]) => ({ status, count }));
    },
  });

  const unidadesQuery = useQuery({
    queryKey: ["dashboard-separacao-unidades", companyId, filters],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("full_order_items")
        .select("quantity, order:full_orders!inner(id, company_id, status, separado_em, separado_por)")
        .eq("order.company_id", companyId as string)
        .in("order.status", STATUS_FINALIZADOS)
        .gte("order.separado_em", filters.dateFrom)
        .lte("order.separado_em", filters.dateTo);
      if (error) throw error;
      let rows = data || [];
      if (filters.operadorId) {
        rows = rows.filter((r: any) => r.order?.separado_por === filters.operadorId);
      }
      return rows;
    },
  });

  const data = useMemo<DashboardData>(() => {
    const ordens = ordensQuery.data || [];
    const ordensCount = ordens.length;

    let tempoTotalMin = 0;
    let tempoCount = 0;
    let slaCumprido = 0;
    let slaCount = 0;
    for (const o of ordens) {
      if (o.separado_em && o.created_at) {
        const diff =
          (new Date(o.separado_em).getTime() - new Date(o.created_at).getTime()) /
          60000;
        if (diff >= 0 && diff < 24 * 60) {
          tempoTotalMin += diff;
          tempoCount++;
        }
      }
      if (o.separado_em && o.previsao_carregamento) {
        slaCount++;
        if (
          new Date(o.separado_em).getTime() <=
          new Date(o.previsao_carregamento).getTime()
        ) {
          slaCumprido++;
        }
      }
    }
    const tempoMedioMin = tempoCount > 0 ? tempoTotalMin / tempoCount : 0;
    const slaCumpridoPct = slaCount > 0 ? (slaCumprido / slaCount) * 100 : 0;

    const dias = daysBetween(filters.dateFrom, filters.dateTo);
    const throughput = ordensCount / dias;

    const byDate: Record<string, { pedidos: number; unidades: number }> = {};
    for (const o of ordens) {
      if (!o.separado_em) continue;
      const date = o.separado_em.split("T")[0];
      if (!byDate[date]) byDate[date] = { pedidos: 0, unidades: 0 };
      byDate[date].pedidos++;
    }
    const separacoesPorDia = fillMissingDays(filters.dateFrom, filters.dateTo, byDate);

    const byOperador: Record<
      string,
      { id: string | null; nome: string; pedidos: number; tempoTotal: number; tempoCount: number }
    > = {};
    for (const o of ordens) {
      const id = o.separado_por || null;
      const key = id || "__none__";
      if (!byOperador[key]) {
        byOperador[key] = {
          id,
          nome:
            (o as any).profiles?.full_name ||
            (id ? `Usuário ${id.slice(0, 8)}` : "Não atribuído"),
          pedidos: 0,
          tempoTotal: 0,
          tempoCount: 0,
        };
      }
      byOperador[key].pedidos++;
      if (o.separado_em && o.created_at) {
        const diff =
          (new Date(o.separado_em).getTime() - new Date(o.created_at).getTime()) /
          60000;
        if (diff >= 0 && diff < 24 * 60) {
          byOperador[key].tempoTotal += diff;
          byOperador[key].tempoCount++;
        }
      }
    }

    const unidadesRows = unidadesQuery.data || [];
    const unidadesByOrdem: Record<string, number> = {};
    for (const row of unidadesRows as any[]) {
      const orderId = row.order?.id;
      if (orderId) {
        unidadesByOrdem[orderId] = (unidadesByOrdem[orderId] || 0) + (row.quantity || 0);
      }
    }
    const totalUnidades = Object.values(unidadesByOrdem).reduce((a, b) => a + b, 0);

    for (const o of ordens) {
      if (!o.separado_em) continue;
      const date = o.separado_em.split("T")[0];
      if (byDate[date]) {
        byDate[date].unidades += unidadesByOrdem[o.id] || 0;
      }
    }

    const separacoesPorDiaFinal = separacoesPorDia.map((d) => ({
      ...d,
      unidades: byDate[d.date]?.unidades || 0,
    }));

    const rankingOperadores: OperadorRanking[] = Object.entries(byOperador)
      .map(([_key, op]) => {
        const opOrdens = ordens.filter(
          (o) => (o.separado_por || null) === op.id
        );
        const unidades = opOrdens.reduce(
          (s, o) => s + (unidadesByOrdem[o.id] || 0),
          0
        );
        return {
          id: op.id,
          nome: op.nome,
          pedidos: op.pedidos,
          unidades,
          tempoMedioMin: op.tempoCount > 0 ? op.tempoTotal / op.tempoCount : 0,
        };
      })
      .sort((a, b) => b.pedidos - a.pedidos);

    return {
      totalSeparados: ordensCount,
      tempoMedioMin,
      totalUnidades,
      throughput,
      slaCumpridoPct,
      separacoesPorDia: separacoesPorDiaFinal,
      rankingOperadores,
      statusAtivos: statusAtivosQuery.data || [],
      ordensDetalhadas: ordens,
    };
  }, [ordensQuery.data, unidadesQuery.data, statusAtivosQuery.data, filters.dateFrom, filters.dateTo, filters.operadorId]);

  return {
    data,
    isLoading:
      ordensQuery.isLoading ||
      statusAtivosQuery.isLoading ||
      unidadesQuery.isLoading,
    isError: ordensQuery.isError || statusAtivosQuery.isError || unidadesQuery.isError,
    error: ordensQuery.error || statusAtivosQuery.error || unidadesQuery.error,
    refetch: () => {
      ordensQuery.refetch();
      statusAtivosQuery.refetch();
      unidadesQuery.refetch();
    },
  };
}
