import { supabase } from "@/integrations/supabase/client";
import type { OrdemFull, OrdemStatus, OrdemItem, BipagemItemState } from "@/hooks/useOrdensFull";
import { stockService } from "./stock";

export const ordersService = {
  async fetchOrdensFull(companyId: string) {
    const { data, error } = await supabase
      .from("full_orders")
      .select(`*, full_order_items(*, product:products(*))`)
      .eq("company_id", companyId)
      .not("frete_ml", "is", null)
      .neq("frete_ml", "")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map((o) => {
      const bipagemState = Array.isArray(o.bipagem_state) ? (o.bipagem_state as unknown as BipagemItemState[]) : [];
      return {
        ...o,
        bipagem_state: bipagemState,
        numero: o.numero || o.frete_ml || o.ordem_id,
        total_produtos: bipagemState.length,
        total_itens: bipagemState.reduce((s: number, i) => s + (i.neededQty || 0), 0),
        total_itens_separados: bipagemState.reduce((s: number, i) => s + (i.scannedQty || 0), 0),
      } as unknown as OrdemFull;
    });
  },

  async buscarOrdem(ordemId: string, companyId: string) {
    return this.fetchOrdemFull(ordemId, companyId);
  },

  async fetchOrdemFull(ordemId: string, companyId: string) {
    const { data: ordem, error } = await supabase
      .from("full_orders")
      .select(`*, full_order_items(*, product:products(*))`)
      .eq("id", ordemId)
      .eq("company_id", companyId)
      .maybeSingle();
    
    if (error) throw error;
    if (!ordem) return null;

    const bipagemState = Array.isArray(ordem?.bipagem_state) ? (ordem.bipagem_state as unknown as BipagemItemState[]) : [];
    const itens = (ordem as any)?.full_order_items?.map((item: any) => {
      const product = item.product;
      const bState = bipagemState.find(b => b.productId === item.product_id);
      
      return {
        id: item.id,
        ordem_id: ordemId,
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
      } as OrdemItem;
    }) || [];

    return { 
      ordem: {
        ...ordem,
        bipagem_state: bipagemState,
        numero: ordem.numero || ordem.frete_ml || ordem.ordem_id,
      } as unknown as OrdemFull, 
      itens
    };
  },

  async createOrdemFull(params: {
    companyId: string;
    descricao: string;
    frete_ml?: string | null;
    itens: {
      product_id?: string;
      kit_id?: string;
      isKit?: boolean;
      components?: { productId: string; name?: string; sku?: string; ean?: string | null; quantity: number }[];
      product?: { id?: string; name?: string; sku?: string; barcode?: string | null; ean?: string | null; image_url?: string | null };
      quantity?: number;
      qtd_solicitada?: number;
    }[];
    status?: OrdemStatus;
  }) {
    // Consolida itens por chave (kit:<kit_id> ou prod:<product_id>), somando as
    // quantidades. Kit = 1 linha (não é mais quebrado em componentes na criação).
    type Consol = {
      key: string;
      product_id?: string;
      kit_id?: string;
      isKit: boolean;
      components?: { productId: string; name?: string; sku?: string; ean?: string | null; quantity: number }[];
      product?: { id?: string; name?: string; sku?: string; barcode?: string | null; ean?: string | null; image_url?: string | null };
      quantity: number;
    };
    const consolidatedMap = new Map<string, Consol>();
    for (const i of params.itens) {
      const qty = i.quantity || i.qtd_solicitada || 0;
      const isKit = !!i.isKit || !!i.kit_id;
      const key = isKit ? `kit:${i.kit_id || i.product?.id}` : `prod:${i.product_id || i.product?.id}`;
      const existing = consolidatedMap.get(key);
      if (existing) {
        existing.quantity += qty;
        if (!existing.product?.name && i.product?.name) existing.product = i.product;
      } else {
        consolidatedMap.set(key, {
          key,
          product_id: isKit ? undefined : (i.product_id || i.product?.id),
          kit_id: isKit ? (i.kit_id || i.product?.id) : undefined,
          isKit,
          components: i.components,
          product: i.product,
          quantity: qty,
        });
      }
    }
    const consolidatedItens = Array.from(consolidatedMap.values());

    const { data: order, error: orderError } = await supabase
      .from("full_orders")
      .insert({
        company_id: params.companyId,
        frete_ml: params.frete_ml,
        descricao: params.descricao,
        status: params.status || 'aguardando',
        bipagem_state: (consolidatedItens.map(i => ({
          productId: (i.isKit ? i.kit_id : i.product_id) as string,
          name: i.product?.name || 'Produto',
          sku: i.product?.sku || '',
          barcode: i.product?.barcode || i.product?.ean || '',
          image_url: i.product?.image_url || null,
          neededQty: i.quantity || 0,
          scannedQty: 0,
          status: 'pendente',
          isKit: i.isKit,
          kitId: i.isKit ? i.kit_id : null,
          components: i.isKit ? (i.components || []) : undefined,
        })) as unknown) as any
      })
      .select()
      .maybeSingle();

    if (orderError) throw orderError;

    const itemsToInsert = consolidatedItens.map(i => ({
      order_id: order.id,
      product_id: i.isKit ? null : (i.product_id as string),
      kit_id: i.isKit ? (i.kit_id as string) : null,
      quantity: i.quantity || 0,
    }));

    if (itemsToInsert.length > 0) {
      const { error: itemsErr } = await supabase.from("full_order_items").insert(itemsToInsert as any);
      if (itemsErr) throw itemsErr;
    }

    return {
      ...order,
      numero: order.numero || order.frete_ml || order.ordem_id,
      bipagem_state: Array.isArray(order.bipagem_state) ? (order.bipagem_state as unknown as BipagemItemState[]) : []
    } as unknown as OrdemFull;
  },

  async updateOrdem(id: string, updates: any, companyId: string) {
    const { error } = await supabase
      .from("full_orders")
      .update(updates)
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw error;
  },

  async updateOrdemStatus(id: string, status: OrdemStatus, companyId: string, extra?: Record<string, any>) {
    // Se for marcar como enviado, dar baixa no stock_full antes de atualizar o status
    if (status === "enviado") {
      const { data: ordem, error: fetchError } = await supabase
        .from("full_orders")
        .select(`*, full_order_items(*, product:products(*))`)
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!ordem) throw new Error("Ordem não encontrada");

      const bipagemItems = Array.isArray(ordem.bipagem_state) ? (ordem.bipagem_state as any[]) : [];

      for (const item of bipagemItems) {
        const qty = item.scannedQty || item.neededQty || 0;
        if (qty <= 0) continue;

        // Expande: produto avulso = 1 movimento; kit = 1 movimento por componente
        type Move = { productId: string; quantity: number };
        const moves: Move[] = [];
        if (item.isKit && Array.isArray(item.components)) {
          for (const c of item.components) {
            if (!c?.productId) continue;
            moves.push({ productId: c.productId, quantity: qty * (c.quantity || 1) });
          }
        } else if (item.productId) {
          moves.push({ productId: item.productId, quantity: qty });
        }

        for (const m of moves) {
          try {
            await stockService.darBaixaFull(
              m.productId,
              m.quantity,
              companyId,
              id,
              `Envio FULL - Baixa do estoque (Ordem ${ordem.frete_ml || ordem.numero || id})${item.isKit ? ' [kit]' : ''}`
            );
          } catch (err: any) {
            console.error(`Erro ao dar baixa FULL do produto ${m.productId}:`, err.message);
            // Não interrompe o fluxo — continua com os demais itens
          }
        }
      }
    }

    const { error } = await supabase
      .from("full_orders")
      .update({ status, ...(extra || {}) })
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw error;
  },

  async updateItemQuantity(params: { itemId: string; qtd_separada: number; qtd_solicitada: number; orderId?: string }, companyId: string) {
    let targetOrderId = params.orderId;
    
    if (!targetOrderId) {
      const { data: itemData } = await supabase
        .from('full_order_items')
        .select('order_id')
        .eq('id', params.itemId)
        .maybeSingle();
      targetOrderId = itemData?.order_id;
    }
    
    if (!targetOrderId) throw new Error("Ordem não identificada");

    const { data: order } = await supabase
      .from('full_orders')
      .select('id, bipagem_state, full_order_items(id, product_id)')
      .eq('id', targetOrderId)
      .eq('company_id', companyId)
      .maybeSingle();
        
    if (!order) throw new Error("Ordem não encontrada");
    
    const item = (order as any).full_order_items?.find((i: any) => i.id === params.itemId);
    if (!item) throw new Error("Item não encontrado na ordem");
    
    const productId = item.product_id;
    const bipagemState = Array.isArray(order.bipagem_state) ? [...order.bipagem_state] : [];
    
    const idx = bipagemState.findIndex((b: any) => b.productId === productId);
    const status = params.qtd_separada >= params.qtd_solicitada ? 'completo' : (params.qtd_separada > 0 ? 'parcial' : 'pendente');
    
    if (idx !== -1) {
      const currentState = (bipagemState[idx] as any) || {};
      bipagemState[idx] = {
        ...currentState,
        scannedQty: params.qtd_separada,
        status
      };
    }
    
    const { error } = await supabase
      .from('full_orders')
      .update({ bipagem_state: bipagemState })
      .eq('id', targetOrderId)
      .eq('company_id', companyId);
        
    if (error) throw error;
    return { orderId: targetOrderId };
  },

  async deleteOrdem(id: string, companyId: string) {
    const { error } = await supabase.from("full_orders").delete().eq("id", id).eq("company_id", companyId);
    if (error) throw error;
  },

  async saveRecording(data: {
    pedidoId: string;
    tipo: string;
    video_url: string;
    duracao_segundos: number;
    companyId: string;
  }) {
    const { pedidoId, tipo, video_url, duracao_segundos, companyId } = data;
    if (!companyId) throw new Error("companyId é obrigatório");
    
    // We store the path if it was signed, or the public URL if not.
    // If it's a signed URL from storage.upload, it will contain 'order_recordings/'
    // but the column is just 'video_url'. We should ensure we can always resolve it.
    
    const { error } = await supabase
      .from("order_recordings")
      .insert({
        pedido_id: pedidoId,
        tipo: tipo,
        video_url: video_url,
        duracao_segundos: duracao_segundos,
        company_id: companyId
      });

    if (error) throw error;
  },

  async finalizarSeparacao(ordemId: string, companyId: string, userId?: string) {
    const { data: ordem, error: fetchError } = await supabase
      .from("full_orders")
      .select(`*`)
      .eq("id", ordemId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!ordem) throw new Error("Ordem não encontrada");
    if (ordem.separado_em) return;

    const bipagemItems = Array.isArray(ordem.bipagem_state) ? (ordem.bipagem_state as any[]) : [];
    
    const { error: updateOrderError } = await supabase
      .from("full_orders")
      .update({ 
        status: "aguardando_carregamento",
        separado_em: new Date().toISOString(),
        separado_por: userId,
        updated_at: new Date().toISOString()
      })
      .eq("id", ordemId)
      .eq("company_id", companyId);

    if (updateOrderError) throw updateOrderError;

    for (const item of bipagemItems) {
      const qty = item.scannedQty || 0;
      if (qty <= 0) continue;

      // Expande: produto avulso = 1 movimento; kit = 1 movimento por componente
      // (productId do componente, qtd × quantity-no-kit).
      type Move = { productId: string; quantity: number };
      const moves: Move[] = [];
      if (item.isKit && Array.isArray(item.components)) {
        for (const c of item.components) {
          if (!c?.productId) continue;
          moves.push({ productId: c.productId, quantity: qty * (c.quantity || 1) });
        }
      } else if (item.productId) {
        moves.push({ productId: item.productId, quantity: qty });
      }

      for (const m of moves) {
        const { data: product } = await supabase
          .from("products")
          .select("stock_physical, stock_full")
          .eq("id", m.productId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (!product) continue;

        const oldPhysical = product.stock_physical || 0;
        const oldFull = product.stock_full || 0;
        const newPhysical = oldPhysical - m.quantity;
        const newFull = oldFull + m.quantity;

        await supabase
          .from("products")
          .update({
            stock_physical: newPhysical,
            stock_full: newFull,
            updated_at: new Date().toISOString()
          })
          .eq("id", m.productId)
          .eq("company_id", companyId);

        await stockService.logMovement({
          productId: m.productId,
          companyId,
          type: 'saida',
          quantity: m.quantity,
          oldStock: oldPhysical,
          newStock: newPhysical,
          stockType: 'physical',
          referenceId: ordemId,
          referenceType: 'order',
          notes: `Separação Full - Saída do Físico (Ordem ${ordem.frete_ml || ordem.numero || ordem.id})${item.isKit ? ' [kit]' : ''}`
        });

        await stockService.logMovement({
          productId: m.productId,
          companyId,
          type: 'entrada',
          quantity: m.quantity,
          oldStock: oldFull,
          newStock: newFull,
          stockType: 'full',
          referenceId: ordemId,
          referenceType: 'order',
          notes: `Separação Full - Entrada no Full (Ordem ${ordem.frete_ml || ordem.numero || ordem.id})${item.isKit ? ' [kit]' : ''}`
        });
      }
    }

    // Sincronizar estoque FULL atualizado com Mercado Livre para cada produto movimentado
    for (const item of bipagemItems) {
      const qty = item.scannedQty || 0;
      if (qty <= 0) continue;

      type Move = { productId: string; quantity: number };
      const moves: Move[] = [];
      if (item.isKit && Array.isArray(item.components)) {
        for (const c of item.components) {
          if (!c?.productId) continue;
          moves.push({ productId: c.productId, quantity: qty * (c.quantity || 1) });
        }
      } else if (item.productId) {
        moves.push({ productId: item.productId, quantity: qty });
      }

      for (const m of moves) {
        try {
          const { data: linkedProducts } = await supabase
            .from("ml_linked_products")
            .select("ml_item_id")
            .eq("product_id", m.productId);

          if (linkedProducts && linkedProducts.length > 0) {
            // Buscar o estoque FULL atual após a transferência
            const { data: product } = await supabase
              .from("products")
              .select("stock_full")
              .eq("id", m.productId)
              .eq("company_id", companyId)
              .maybeSingle();

            if (product) {
              for (const link of linkedProducts) {
                supabase.functions.invoke("ml-api", {
                  body: {
                    action: "sync-stock",
                    itemId: link.ml_item_id,
                    quantity: product.stock_full || 0,
                  },
                  headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
                }).catch((err: any) => console.error(`Erro ao sincronizar estoque ML para ${link.ml_item_id}:`, err.message));
              }
            }
          }
        } catch (err: any) {
          console.error(`Erro ao sincronizar ML para produto ${m.productId}:`, err.message);
        }
      }
    }

    const { error: auditErr } = await supabase.from("company_audit_log").insert({
      company_id: companyId,
      user_id: userId,
      action: "full_order_separated",
      details: {
        order_id: ordemId,
        frete_ml: ordem.frete_ml,
        items_count: bipagemItems.length,
        timestamp: new Date().toISOString()
      }
    });
    if (auditErr) console.error("Erro no audit log:", auditErr.message);
  }
};
