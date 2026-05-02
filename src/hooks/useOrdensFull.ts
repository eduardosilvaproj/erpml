import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useAuth } from "@/contexts/AuthContext";
import { ordersService } from "@/services/orders";
import type { Database, Json } from "@/integrations/supabase/types";

/** Valid statuses for an order in the Full flow. */
export type OrdemStatus = "pdf_carregado" | "separando" | "aguardando_carregamento" | "carregando" | "enviado" | "rascunho" | "aguardando" | "em_separacao" | "separada" | "concluida" | "cancelada" | "pausado";

/** Valid statuses for an individual item within an order. */
export type ItemStatus = "pendente" | "parcial" | "completo" | "excesso";

/**
 * State of a single product during the scanning (bipagem) process.
 */
export interface BipagemItemState {
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  image_url: string | null;
  neededQty: number;
  scannedQty: number;
  status: ItemStatus;
}

/**
 * Interface representing a Full Order.
 * Directly mapped from the database with computed fields.
 */
export type OrdemFull = Database["public"]["Tables"]["full_orders"]["Row"] & {
  bipagem_state?: BipagemItemState[] | null;
  total_itens?: number;
  total_produtos?: number;
  total_itens_separados?: number;
  total_produtos_separados?: number;
  atribuido?: { full_name: string | null } | null;
  separado_por_profile?: { full_name: string | null } | null;
  prazo?: string | null;
  atribuido_para?: string | null;
  numero: string;
};

/**
 * Interface representing an item within a Full Order.
 */
export interface OrdemItem {
  id: string;
  ordem_id: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  image_url: string | null;
  neededQty: number;
  scannedQty: number;
  status: ItemStatus;
  product_id?: string;
  qtd_solicitada?: number;
  qtd_separada?: number;
  product?: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    ean?: string | null;
    image_url: string | null;
    stock_physical: number;
    stock_full: number;
    gtin_cx?: string | null;
    box_quantity?: number | null;
  } | null;
}

/**
 * Hook to fetch all Full orders for the current company.
 */
export const useOrdensFull = () => {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["ordens-full", companyId],
    enabled: !!companyId,
    queryFn: () => ordersService.fetchOrdensFull(companyId!),
  });
};

/**
 * Hook to fetch a single Full order and its items.
 * @param ordemId Unique ID of the order.
 */
export const useOrdemFull = (ordemId: string | null) => {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["ordem-full", ordemId, companyId],
    enabled: !!ordemId && !!companyId,
    queryFn: () => ordersService.fetchOrdemFull(ordemId!, companyId!),
  });
};

/**
 * Hook to create a new Full order.
 */
export const useCreateOrdemFull = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (params: {
      descricao: string;
      frete_ml?: string | null;
      prazo?: string | null;
      atribuido_para?: string | null;
      enviarParaSeparacao?: boolean;
      itens: { 
        product_id: string; 
        product?: { name?: string; sku?: string; barcode?: string | null; image_url?: string | null }; 
        quantity?: number; 
        qtd_solicitada?: number 
      }[];
      status?: OrdemStatus | string;
    }) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return ordersService.createOrdemFull({ 
        ...params, 
        companyId,
        status: params.status as OrdemStatus
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ordens-full"] }),
  });
};

/**
 * Hook to update the status of a Full order.
 */
export const useUpdateOrdemStatus = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: ({ id, status, extra }: { id: string; status: OrdemStatus | string; extra?: Record<string, Json> }) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return ordersService.updateOrdemStatus(id, status, companyId, extra);
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
      qc.invalidateQueries({ queryKey: ["ordem-full", v.id] });
    },
  });
};

/**
 * Hook to update the separated quantity of an item.
 */
export const useUpdateItemQuantity = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (params: { itemId: string; qtd_separada: number; qtd_solicitada: number; orderId?: string }) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return ordersService.updateItemQuantity(params, companyId);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ordem-full"] });
      if (data?.orderId) qc.invalidateQueries({ queryKey: ["ordem-full", data.orderId] });
    },
  });
};

/**
 * Hook to delete an order.
 */
export const useDeleteOrdem = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: ({ id }: { id: string; frete_ml?: string | null }) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return ordersService.deleteOrdem(id, companyId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
      qc.invalidateQueries({ queryKey: ["full-orders", companyId] });
    },
  });
};

/**
 * Generic update for Full orders.
 */
export const useUpdateFullOrder = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: ({ id, status, ...rest }: { id: string; status: OrdemStatus; [key: string]: Json }) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return ordersService.updateOrdemStatus(id, status, companyId, rest);
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
    mutationFn: (id: string) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return ordersService.deleteOrdem(id, companyId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["full-orders", companyId] });
      qc.invalidateQueries({ queryKey: ["ordens-full", companyId] });
    },
  });
};

export const useMarcarOrdemEnviada = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (ordemId: string) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return ordersService.updateOrdemStatus(ordemId, "enviado", companyId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
    },
  });
};

export const useConcluirOrdem = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (ordemId: string) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return ordersService.updateOrdemStatus(ordemId, "concluida", companyId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
    },
  });
};

export const useMarcarOrdemSeparada = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const companyId = useCompanyId();
  
  return useMutation({
    mutationFn: (ordemId: string) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return ordersService.finalizarSeparacao(ordemId, companyId, user?.id);
    },
    onSuccess: (_, ordemId) => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
      qc.invalidateQueries({ queryKey: ["ordem-full", ordemId] });
    },
  });
};

export const useEnvioPendente = () => {
  return useQuery({
    queryKey: ["envio-pendente"],
    queryFn: async () => [],
    enabled: false
  });
};

export const useLimparEnvioPendente = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {},
    onSuccess: () => qc.invalidateQueries({ queryKey: ["envio-pendente"] }),
  });
};

export const ordemStatusBadge = (s: OrdemStatus) => {
  const map: Record<OrdemStatus, { label: string; cls: string }> = {
    pdf_carregado: { label: "🔵 PDF Carregado", cls: "bg-blue-100 text-blue-700 border-blue-200" },
    separando: { label: "🟡 Em Separação", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    aguardando_carregamento: { label: "🟣 Aguard. Coleta", cls: "bg-purple-100 text-purple-700 border-purple-200" },
    carregando: { label: "Carregando", cls: "bg-blue-500 text-white animate-pulse" },
    enviado: { label: "🟢 Enviado", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
    aguardando: { label: "Aguardando", cls: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
    em_separacao: { label: "🟡 Em Separação", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    separada: { label: "🟣 Aguard. Coleta", cls: "bg-purple-100 text-purple-700 border-purple-200" },
    concluida: { label: "Concluída", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    cancelada: { label: "🔴 Cancelada", cls: "bg-destructive/15 text-destructive border-destructive/20" },
    pausado: { label: "🟠 Pausado", cls: "bg-orange-100 text-orange-700 border-orange-200" },
  };
  return map[s] || { label: s, cls: "bg-gray-100 text-gray-700" };
};

export const itemStatusBadge = (s: ItemStatus) => {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-muted text-muted-foreground" },
    parcial: { label: "Parcial", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    completo: { label: "Completo", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    excesso: { label: "Excesso", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  return map[s] || { label: s, cls: "bg-gray-100 text-gray-700" };
};
