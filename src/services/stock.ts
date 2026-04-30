import { supabase } from "@/integrations/supabase/client";

export const stockService = {
  async logMovement(params: {
    productId: string;
    companyId: string;
    type: 'entrada' | 'saida' | 'ajuste' | 'transferencia';
    quantity: number;
    oldStock: number;
    newStock: number;
    stockType: 'physical' | 'full';
    referenceId?: string;
    referenceType?: 'order' | 'invoice' | 'transfer' | 'manual';
    notes?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from("stock_movement_logs").insert({
      product_id: params.productId,
      company_id: params.companyId,
      user_id: user?.id,
      type: params.type,
      quantity: params.quantity,
      old_stock: params.oldStock,
      new_stock: params.newStock,
      stock_type: params.stockType,
      reference_id: params.referenceId,
      reference_type: params.referenceType,
      notes: params.notes
    });
  },

  async darBaixa(productId: string, quantity: number, companyId: string) {
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("stock_physical")
      .eq("id", productId)
      .eq("company_id", companyId)
      .maybeSingle();
    
    if (fetchError) throw fetchError;
    if (!product) throw new Error("Produto não encontrado");
    const oldStock = product.stock_physical || 0;
    if (oldStock < quantity) {
      throw new Error("Estoque insuficiente");
    }

    const newStock = oldStock - quantity;
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock_physical: newStock })
      .eq("id", productId)
      .eq("company_id", companyId);
    
    if (updateError) throw updateError;

    await this.logMovement({
      productId,
      companyId,
      type: 'saida',
      quantity,
      oldStock,
      newStock,
      stockType: 'physical',
      notes: 'Baixa manual de estoque'
    });
  },

  async creditarFull(productId: string, quantity: number, companyId: string) {
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("stock_full")
      .eq("id", productId)
      .eq("company_id", companyId)
      .maybeSingle();
    
    if (fetchError) throw fetchError;
    if (!product) throw new Error("Produto não encontrado");

    const oldStock = product.stock_full || 0;
    const newStock = oldStock + quantity;
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock_full: newStock })
      .eq("id", productId)
      .eq("company_id", companyId);
    
    if (updateError) throw updateError;

    await this.logMovement({
      productId,
      companyId,
      type: 'entrada',
      quantity,
      oldStock,
      newStock,
      stockType: 'full',
      notes: 'Crédito manual Full'
    });
  },

  async ajustarFisico(productId: string, newQuantity: number, companyId: string, notes?: string) {
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("stock_physical")
      .eq("id", productId)
      .eq("company_id", companyId)
      .maybeSingle();
    
    if (fetchError) throw fetchError;
    if (!product) throw new Error("Produto não encontrado");

    const oldStock = product.stock_physical || 0;
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock_physical: newQuantity })
      .eq("id", productId)
      .eq("company_id", companyId);
    
    if (updateError) throw updateError;

    await this.logMovement({
      productId,
      companyId,
      type: 'ajuste',
      quantity: newQuantity - oldStock,
      oldStock,
      newStock: newQuantity,
      stockType: 'physical',
      notes: notes || 'Ajuste de estoque'
    });
  },

  async fetchTransferOrders(companyId: string | null) {
    let query = supabase
      .from("transfer_orders")
      .select("*, transfer_items(*, products(id, name, sku, barcode))")
      .order("created_at", { ascending: false });

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async createTransferOrder(params: {
    items: any[];
    notes?: string;
    companyId: string | null;
  }) {
    const { items, notes, companyId } = params;

    // Check stock first
    for (const item of items) {
      const { data: product } = await supabase
        .from("products")
        .select("stock_physical")
        .eq("id", item.productId)
        .maybeSingle();
      if (!product || product.stock_physical < item.quantity) {
        throw new Error(`Estoque insuficiente para "${item.productName}". Disponível: ${product?.stock_physical ?? 0}, Solicitado: ${item.quantity}`);
      }
    }

    const orderNumber = `TRF-${Date.now().toString(36).toUpperCase()}`;

    const { data: order, error } = await supabase
      .from("transfer_orders")
      .insert({
        order_number: orderNumber,
        status: "separando",
        total_items: items.length,
        total_quantity: items.reduce((sum, i) => sum + i.quantity, 0),
        company_id: companyId,
        notes: notes || null,
      })
      .select()
      .maybeSingle();
    if (error) throw error;

    const transferItems = items.map((i) => ({
      transfer_order_id: order.id,
      product_id: i.productId,
      quantity: i.quantity,
    }));
    await supabase.from("transfer_items").insert(transferItems);

    for (const item of items) {
      const { data: current } = await supabase
        .from("products")
        .select("stock_physical, stock_full")
        .eq("id", item.productId)
        .maybeSingle();
      if (current) {
        const oldPhysical = current.stock_physical || 0;
        const oldFull = current.stock_full || 0;
        const newPhysical = oldPhysical - item.quantity;
        const newFull = oldFull + item.quantity;

        await supabase
          .from("products")
          .update({
            stock_physical: newPhysical,
            stock_full: newFull,
          })
          .eq("id", item.productId);

        await this.logMovement({
          productId: item.productId,
          companyId: companyId || '',
          type: 'transferencia',
          quantity: item.quantity,
          oldStock: oldPhysical,
          newStock: newPhysical,
          stockType: 'physical',
          referenceId: order.id,
          referenceType: 'transfer',
          notes: `Transferência para Full - Saída do Físico (Ordem ${orderNumber})`
        });

        await this.logMovement({
          productId: item.productId,
          companyId: companyId || '',
          type: 'transferencia',
          quantity: item.quantity,
          oldStock: oldFull,
          newStock: newFull,
          stockType: 'full',
          referenceId: order.id,
          referenceType: 'transfer',
          notes: `Transferência para Full - Entrada no Full (Ordem ${orderNumber})`
        });
      }
    }

    return order;
  },

  async updateTransferStatus(id: string, status: string, companyId: string) {
    const updates: Record<string, any> = { status };
    if (status === "enviado") updates.sent_at = new Date().toISOString();
    if (status === "recebido_full") updates.received_at = new Date().toISOString();
    if (status === "conferido_full") updates.confirmed_at = new Date().toISOString();

    const { error } = await supabase
      .from("transfer_orders")
      .update(updates as any)
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw error;
  }
};
