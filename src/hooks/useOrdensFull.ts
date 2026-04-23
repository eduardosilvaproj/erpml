import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export type OrdemStatus = "rascunho" | "aguardando" | "em_separacao" | "separada" | "concluida" | "enviada" | "cancelada";
export type ItemStatus = "pendente" | "parcial" | "completo" | "excesso";

export interface OrdemFull {
  id: string;
  numero: string;
  descricao: string | null;
  status: OrdemStatus;
  prazo: string | null;
  company_id: string;
  criado_por: string;
  atribuido_para: string | null;
  gravacao_id: string | null;
  iniciada_em: string | null;
  concluida_em: string | null;
  total_itens: number;
  total_produtos: number;
  total_itens_separados: number;
  total_produtos_separados: number;
  created_at: string;
  updated_at: string;
}

export interface OrdemItem {
  id: string;
  ordem_id: string;
  product_id: string;
  qtd_solicitada: number;
  qtd_separada: number;
  status: ItemStatus;
  product?: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    image_url: string | null;
    stock_physical: number;
    stock_full: number;
  };
}

export const useOrdensFull = () => {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["ordens-full", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<OrdemFull[]> => {
      const { data, error } = await supabase
        .from("ordens_full")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as OrdemFull[];
    },
  });
};

export const useOrdemFull = (ordemId: string | null) => {
  return useQuery({
    queryKey: ["ordem-full", ordemId],
    enabled: !!ordemId,
    queryFn: async () => {
      const { data: ordem, error } = await supabase
        .from("ordens_full")
        .select("*")
        .eq("id", ordemId!)
        .maybeSingle();
      if (error) throw error;

      const { data: itens, error: e2 } = await supabase
        .from("ordens_full_itens")
        .select("*, product:products(id, name, sku, barcode, image_url, stock_physical, stock_full)")
        .eq("ordem_id", ordemId!);
      if (e2) throw e2;

      return { ordem: ordem as OrdemFull | null, itens: (itens || []) as OrdemItem[] };
    },
  });
};

export const useCreateOrdemFull = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: async (params: {
      descricao: string;
      prazo: string | null;
      atribuido_para: string | null;
      itens: { product_id: string; qtd_solicitada: number }[];
      enviarParaSeparacao: boolean;
    }) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Não autenticado");

      const totalProdutos = params.itens.length;
      const totalItens = params.itens.reduce((s, i) => s + i.qtd_solicitada, 0);

      const { data: ordem, error } = await supabase
        .from("ordens_full")
        .insert({
          descricao: params.descricao,
          prazo: params.prazo,
          atribuido_para: params.atribuido_para,
          status: params.enviarParaSeparacao ? "aguardando" : "rascunho",
          company_id: companyId,
          criado_por: userId,
          total_itens: totalItens,
          total_produtos: totalProdutos,
        })
        .select()
        .single();
      if (error) throw error;

      if (params.itens.length > 0) {
        const { error: e2 } = await supabase
          .from("ordens_full_itens")
          .insert(
            params.itens.map((i) => ({
              ordem_id: ordem.id,
              product_id: i.product_id,
              qtd_solicitada: i.qtd_solicitada,
            })),
          );
        if (e2) throw e2;
      }
      return ordem as OrdemFull;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ordens-full"] }),
  });
};

export const useUpdateOrdemStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, extra }: { id: string; status: OrdemStatus; extra?: Record<string, any> }) => {
      const payload: any = { status, ...(extra || {}) };
      if (status === "em_separacao" && !payload.iniciada_em) payload.iniciada_em = new Date().toISOString();
      const { error } = await supabase.from("ordens_full").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
      qc.invalidateQueries({ queryKey: ["ordem-full", v.id] });
    },
  });
};

export const useUpdateItemQuantity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, qtd_separada, qtd_solicitada }: { itemId: string; qtd_separada: number; qtd_solicitada: number }) => {
      let status: ItemStatus = "pendente";
      if (qtd_separada === 0) status = "pendente";
      else if (qtd_separada < qtd_solicitada) status = "parcial";
      else if (qtd_separada === qtd_solicitada) status = "completo";
      else status = "excesso";
      const { error } = await supabase
        .from("ordens_full_itens")
        .update({ qtd_separada, status })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ordem-full"] }),
  });
};

export const useConcluirOrdem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordemId: string) => {
      const { error } = await supabase.rpc("concluir_ordem_full", { _ordem_id: ordemId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
      qc.invalidateQueries({ queryKey: ["ordem-full"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

export const useMarcarOrdemSeparada = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordemId: string) => {
      const { error } = await supabase.rpc("marcar_ordem_separada", { _ordem_id: ordemId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
      qc.invalidateQueries({ queryKey: ["ordem-full"] });
      qc.invalidateQueries({ queryKey: ["envio-pendente"] });
    },
  });
};

export const useMarcarOrdemEnviada = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordemId: string) => {
      const { error } = await supabase.rpc("marcar_ordem_enviada", { _ordem_id: ordemId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
      qc.invalidateQueries({ queryKey: ["envio-pendente"] });
    },
  });
};

export const useEnvioPendente = () => {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["envio-pendente", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("envio_pendente" as any)
        .select("*, ordem:ordens_full(id, numero), product:products(id, name, sku, barcode, image_url, stock_physical)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
};

export const useLimparEnvioPendente = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: async (ordemId?: string) => {
      let q = supabase.from("envio_pendente" as any).delete().eq("company_id", companyId!);
      if (ordemId) q = q.eq("ordem_id", ordemId);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["envio-pendente"] }),
  });
};

export const useDeleteFullOrder = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("full_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["full-orders", companyId] }),
  });
};


export const ordemStatusBadge = (s: OrdemStatus) => {
  const map: Record<OrdemStatus, { label: string; cls: string }> = {
    rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
    aguardando: { label: "Aguardando", cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
    em_separacao: { label: "Em separação", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400 animate-pulse" },
    separada: { label: "Separada", cls: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
    concluida: { label: "Concluída", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    enviada: { label: "Enviada ao FULL", cls: "bg-emerald-700/20 text-emerald-700 dark:text-emerald-300" },
    cancelada: { label: "Cancelada", cls: "bg-destructive/15 text-destructive" },
  };
  return map[s];
};

export const itemStatusBadge = (s: ItemStatus) => {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-muted text-muted-foreground" },
    parcial: { label: "Parcial", cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
    completo: { label: "Completo", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    excesso: { label: "Excesso", cls: "bg-destructive/15 text-destructive" },
  };
  return map[s];
};
