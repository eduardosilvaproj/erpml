import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useAuth } from "@/contexts/AuthContext";

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
  // Compatibility fields
  total_itens?: number;
  total_produtos?: number;
  total_itens_separados?: number;
  total_produtos_separados?: number;
  atribuido_para?: string | null;
  atribuido?: { full_name: string | null } | null;
  separado_por_profile?: { full_name: string | null } | null;
  prazo?: string | null;
}

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
  // Compatibility fields
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
  };
}

export const useOrdensFull = () => {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["ordens-full", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<OrdemFull[]> => {
      const { data, error } = await supabase
        .from("full_orders")
        .select(`*, full_order_items(*, product:products(*))`)
        .eq("company_id", companyId!)
        .not("frete_ml", "is", null)
        .neq("frete_ml", "")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      return (data || []).map((o: any) => ({
        ...o,
        numero: o.numero || o.frete_ml || o.ordem_id,
        total_produtos: Array.isArray(o.bipagem_state) ? o.bipagem_state.length : 0,
        total_itens: Array.isArray(o.bipagem_state) ? o.bipagem_state.reduce((s: number, i: any) => s + (i.neededQty || 0), 0) : 0,
        total_itens_separados: Array.isArray(o.bipagem_state) ? o.bipagem_state.reduce((s: number, i: any) => s + (i.scannedQty || 0), 0) : 0,
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
        .select(`*, full_order_items(*, product:products(*))`)
        .eq("id", ordemId!)
        .maybeSingle();
      if (error) throw error;

      const bipagemState = Array.isArray(ordem?.bipagem_state) ? (ordem.bipagem_state as any[]) : [];
      const itens = (ordem as any)?.full_order_items?.map((item: any) => {
        const product = item.product;
        const bState = bipagemState.find(b => b.productId === item.product_id);
        
        return {
          id: item.id,
          ordem_id: ordemId!,
          productId: item.product_id,
          name: product?.name || bState?.name || 'Produto',
          sku: product?.sku || bState?.sku || '',
          barcode: product?.barcode || bState?.barcode || '',
          image_url: product?.image_url || bState?.image_url || null,
          neededQty: item.quantity || bState?.neededQty || 0,
          scannedQty: bState?.scannedQty || 0,
          qtd_solicitada: item.quantity || bState?.neededQty || 0,
          qtd_separada: bState?.scannedQty || 0,
          status: bState?.status || 'pendente',
          product: product ? {
            id: product.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            ean: product.ean,
            image_url: product.image_url,
            stock_physical: product.stock_physical || 0,
            stock_full: product.stock_full || 0,
            gtin_cx: product.gtin_cx,
            box_quantity: product.box_quantity
          } : null
        };
      }) || [];

      return { 
        ordem: (ordem ? {
          ...ordem,
          numero: ordem.numero || ordem.frete_ml || ordem.ordem_id,
        } : null) as OrdemFull | null, 
        itens: itens as OrdemItem[] 
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
      prazo?: string | null;
      atribuido_para?: string | null;
      enviarParaSeparacao?: boolean;
      itens: { product_id: string; product?: any; quantity?: number; qtd_solicitada?: number }[];
      status?: OrdemStatus;
    }) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      
      // 1. Insert the main order
      const { data: order, error: orderError } = await supabase
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
            neededQty: i.quantity || i.qtd_solicitada || 0,
            scannedQty: 0,
            status: 'pendente'
          })) as any
        })
        .select()
        .maybeSingle();

      if (orderError) throw orderError;

      // 2. Insert items into full_order_items for proper relational joins
      const itemsToInsert = params.itens.map(i => ({
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity || i.qtd_solicitada || 0
      }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("full_order_items")
          .insert(itemsToInsert);
        
        if (itemsError) {
          console.error("Erro ao inserir itens da ordem FULL:", itemsError);
          // We don't necessarily throw here if the main order was created, 
          // but it's better to keep them in sync.
        }
      }

      return order as OrdemFull;
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

export const useUpdateItemQuantity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, qtd_separada, qtd_solicitada, orderId }: { itemId: string; qtd_separada: number; qtd_solicitada: number; orderId?: string }) => {
      let targetOrderId = orderId;
      
      if (!targetOrderId) {
        const { data: itemData } = await supabase
          .from('full_order_items')
          .select('order_id')
          .eq('id', itemId)
          .maybeSingle();
        targetOrderId = itemData?.order_id;
      }
      
      if (!targetOrderId) throw new Error("Ordem não identificada");

      const { data: order } = await supabase
        .from('full_orders')
        .select('id, bipagem_state, full_order_items(id, product_id)')
        .eq('id', targetOrderId)
        .maybeSingle();
        
      if (!order) throw new Error("Ordem não encontrada");
      
      const item = (order as any).full_order_items?.find((i: any) => i.id === itemId);
      if (!item) throw new Error("Item não encontrado na ordem");
      
      const productId = item.product_id;
      const bipagemState = Array.isArray(order.bipagem_state) ? [...order.bipagem_state] : [];
      
      const idx = bipagemState.findIndex((b: any) => b.productId === productId);
      const status = qtd_separada >= qtd_solicitada ? 'completo' : (qtd_separada > 0 ? 'parcial' : 'pendente');
      
      if (idx !== -1) {
        const currentState = (bipagemState[idx] as any) || {};
        bipagemState[idx] = {
          ...currentState,
          scannedQty: qtd_separada,
          status
        };
      }
      
      const { error } = await supabase
        .from('full_orders')
        .update({ bipagem_state: bipagemState })
        .eq('id', targetOrderId);
        
      if (error) throw error;
      return { orderId: targetOrderId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ordem-full"] });
      if (data?.orderId) qc.invalidateQueries({ queryKey: ["ordem-full", data.orderId] });
    },
  });
};

export const useDeleteOrdem = () => {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: async ({ id, frete_ml }: { id: string; frete_ml?: string | null }) => {
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

export const useConcluirOrdem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordemId: string) => {
      const { error } = await supabase
        .from("full_orders")
        .update({ status: "concluida" })
        .eq("id", ordemId);
      if (error) throw error;
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
    mutationFn: async (ordemId: string) => {
      // 1. Fetch current order state to prevent double execution and get items
      const { data: ordem, error: fetchError } = await supabase
        .from("full_orders")
        .select(`*`)
        .eq("id", ordemId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      // Proteção contra duplicidade: Verificar se separado_em já está preenchido
      if (ordem.separado_em) {
        console.log("Ordem já marcada como separada, pulando movimentação de estoque.");
        return;
      }

      // Usar bipagem_state para saber as quantidades reais bipadas
      const bipagemItems = Array.isArray(ordem.bipagem_state) ? (ordem.bipagem_state as any[]) : [];
      
      if (bipagemItems.length === 0) {
        console.warn("Não há itens bipados para processar o estoque.");
      }

      // 2. Atualizar status e timestamp da ordem
      const { error: updateOrderError } = await supabase
        .from("full_orders")
        .update({ 
          status: "aguardando_carregamento",
          separado_em: new Date().toISOString(),
          separado_por: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq("id", ordemId);

      if (updateOrderError) throw updateOrderError;

      // 3. Atualizar estoques para cada produto bipado
      for (const item of bipagemItems) {
        const qty = item.scannedQty || 0;
        if (qty <= 0) continue;

        const productId = item.productId;

        // Buscar estoque atual para calcular o novo valor (PostgREST não suporta incremento direto no update)
        const { data: product, error: prodError } = await supabase
          .from("products")
          .select("stock_physical, stock_full")
          .eq("id", productId)
          .eq("company_id", companyId!)
          .maybeSingle();

        if (prodError) {
          console.error(`Erro ao buscar produto ${productId}:`, prodError);
          continue;
        }

        if (product) {
          const { error: stockError } = await supabase
            .from("products")
            .update({
              stock_physical: (product.stock_physical || 0) - qty,
              stock_full: (product.stock_full || 0) + qty,
              updated_at: new Date().toISOString()
            })
            .eq("id", productId)
            .eq("company_id", companyId!);
            
          if (stockError) {
            console.error(`Erro ao atualizar estoque do produto ${productId}:`, stockError);
          }
        }
      }

      // 4. Registrar no log de auditoria
      await supabase.from("company_audit_log").insert({
        company_id: companyId!,
        user_id: user?.id,
        action: "full_order_separated",
        details: {
          order_id: ordemId,
          frete_ml: ordem.frete_ml,
          items_count: bipagemItems.length,
          timestamp: new Date().toISOString()
        }
      });
    },
    onSuccess: (_, ordemId) => {
      qc.invalidateQueries({ queryKey: ["ordens-full"] });
      qc.invalidateQueries({ queryKey: ["ordem-full", ordemId] });
    },
  });
};

// Mock functions for compatibility
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
