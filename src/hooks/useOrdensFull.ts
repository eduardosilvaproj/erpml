import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export type OrdemStatus = "pdf_carregado" | "separando" | "aguardando_carregamento" | "carregando" | "enviado" | "rascunho" | "aguardando" | "em_separacao" | "separada" | "concluida" | "cancelada" | "pausado";
export type ItemStatus = "pendente" | "parcial" | "completo" | "excesso";

export interface OrdemFull {
  id: string;
  ordem_id: string;
  numero: string;
  frete_ml: string | null;
  descricao: string | null;
  status: OrdemStatus;
  previsao_carregamento?: string | null;
  company_id: string;
  separado_em?: string | null;
  separado_por?: string | null;
  bipagem_state?: any;
  created_at: string;
  updated_at: string;
  // Compatibility fields (can be derived)
  total_itens?: number;
  total_produtos?: number;
}

export interface OrdemItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  image_url: string | null;
  neededQty: number;
  scannedQty: number;
  status: ItemStatus;
}

export const useOrdensFull = () => {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["ordens-full", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<OrdemFull[]> => {
      const { data, error } = await supabase
        .from("full_orders")
        .select(`*`)
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      return (data || []).map((o: any) => ({
        ...o,
        numero: o.numero || o.frete_ml || o.ordem_id,
        total_produtos: Array.isArray(o.bipagem_state) ? o.bipagem_state.length : 0,
        total_itens: Array.isArray(o.bipagem_state) ? o.bipagem_state.reduce((s: number, i: any) => s + (i.neededQty || 0), 0) : 0,
      })) as OrdemFull[];
    },
  });
};

export const useOrdemFull = (ordemId: string | null) => {
  return useQuery({
    queryKey: ["ordem-full", ordemId],
    enabled: !!ordemId,
    queryFn: async () => {
      const { data: ordem, error } = await supabase
        .from("full_orders")
        .select(`*`)
        .eq("id", ordemId!)
        .maybeSingle();
      if (error) throw error;

      const itens = Array.isArray(ordem?.bipagem_state) ? (ordem.bipagem_state as any[]).map((i, idx) => ({
        id: String(idx),
        ...i
      })) : [];

      return { 
        ordem: (ordem ? {
          ...ordem,
          numero: ordem.numero || ordem.frete_ml || ordem.ordem_id,
        } : null) as OrdemFull | null, 
        itens: itens as any[] 
      };
    },
  });
};

export const useCreateOrdemFull = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: async (params: {
      descricao: string;
      frete_ml?: string | null;
      itens: { product_id: string; product?: any; quantity: number }[];
      status?: OrdemStatus;
    }) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      
      const { data, error } = await supabase
        .from("full_orders")
        .insert({
          company_id: companyId,
          frete_ml: params.frete_ml,
          descricao: params.descricao,
          status: params.status || 'aguardando',
          bipagem_state: params.itens.map(i => ({
            productId: i.product_id,
            name: i.product?.name || 'Produto',
            sku: i.product?.sku || '',
            barcode: i.product?.barcode || '',
            image_url: i.product?.image_url || null,
            neededQty: i.quantity,
            scannedQty: 0,
            status: 'pendente'
          })) as any
        })
        .select()
        .single();
      if (error) throw error;
      return data as OrdemFull;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ordens-full"] }),
  });
};

export const useUpdateOrdemStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, extra }: { id: string; status: OrdemStatus; extra?: Record<string, any> }) => {
      const { error } = await supabase
        .from("full_orders")
        .update({ status, ...(extra || {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
      qc.invalidateQueries({ queryKey: ["ordem-full", v.id] });
    },
  });
};

export const useDeleteOrdem = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("full_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
      qc.invalidateQueries({ queryKey: ["full-orders", companyId] });
    },
  });
};

export const useUpdateFullOrder = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: async ({ id, status, frete_ml, ...rest }: { id?: string; frete_ml?: string; status: string; [key: string]: any }) => {
      if (!companyId) throw new Error("Empresa não identificada");
      let query = supabase.from("full_orders").update({ status, ...rest }).eq("company_id", companyId);
      
      if (id) {
        query = query.eq("id", id);
      } else if (frete_ml) {
        query = query.eq("frete_ml", frete_ml);
      } else {
        throw new Error("Necessário ID ou frete_ml para atualizar");
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["full-orders", companyId] });
      qc.invalidateQueries({ queryKey: ["ordens-full", companyId] });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["full-orders", companyId] });
      qc.invalidateQueries({ queryKey: ["ordens-full", companyId] });
    },
  });
};

export const useMarcarOrdemEnviada = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordemId: string) => {
      const { error } = await supabase
        .from("full_orders")
        .update({ status: "enviado" })
        .eq("id", ordemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
    },
  });
};

// Mock functions for compatibility with components that haven't been refactored yet
export const useEnvioPendente = () => {
  return useQuery({
    queryKey: ["envio-pendente"],
    queryFn: async () => [],
    enabled: false
  });
};

export const useUpdateItemQuantity = () => {
  return useMutation({
    mutationFn: async () => {},
  });
};

export const useConcluirOrdem = () => {
  return useMutation({
    mutationFn: async () => {},
  });
};

export const useMarcarOrdemSeparada = () => {
  return useMutation({
    mutationFn: async () => {},
  });
};

export const useLimparEnvioPendente = () => {
  return useMutation({
    mutationFn: async () => {},
  });
};

export const ordemStatusBadge = (s: OrdemStatus) => {
  const map: Record<OrdemStatus, { label: string; cls: string }> = {
    pdf_carregado: { label: "PDF Carregado", cls: "bg-blue-100 text-blue-700" },
    separando: { label: "Separando", cls: "bg-amber-100 text-amber-700" },
    aguardando_carregamento: { label: "🚛 Aguardando coleta", cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 font-bold" },
    carregando: { label: "Carregando", cls: "bg-blue-500 text-white animate-pulse" },
    enviado: { label: "Enviado", cls: "bg-emerald-100 text-emerald-700" },
    rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
    aguardando: { label: "Aguardando", cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
    em_separacao: { label: "Em separação", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400 animate-pulse" },
    separada: { label: "🚛 Aguardando coleta", cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 font-bold" },
    concluida: { label: "Concluída", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    cancelada: { label: "Cancelada", cls: "bg-destructive/15 text-destructive" },
    pausado: { label: "Pausado", cls: "bg-amber-100 text-amber-700" },
  };
  return map[s] || { label: s, cls: "bg-gray-100" };
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
