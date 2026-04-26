import { supabase } from "@/integrations/supabase/client";

export const stockService = {
  async darBaixa(productId: string, quantity: number, companyId: string) {
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("stock_physical")
      .eq("id", productId)
      .eq("company_id", companyId)
      .single();
    
    if (fetchError) throw fetchError;
    if ((product.stock_physical || 0) < quantity) {
      throw new Error("Estoque insuficiente");
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock_physical: (product.stock_physical || 0) - quantity })
      .eq("id", productId)
      .eq("company_id", companyId);
    
    if (updateError) throw updateError;
  },

  async creditarFull(productId: string, quantity: number, companyId: string) {
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("stock_full")
      .eq("id", productId)
      .eq("company_id", companyId)
      .single();
    
    if (fetchError) throw fetchError;

    const { error: updateError } = await supabase
      .from("products")
      .update({ stock_full: (product.stock_full || 0) + quantity })
      .eq("id", productId)
      .eq("company_id", companyId);
    
    if (updateError) throw updateError;
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
        await supabase
          .from("products")
          .update({
            stock_physical: (current.stock_physical || 0) - item.quantity,
            stock_full: (current.stock_full || 0) + item.quantity,
          })
          .eq("id", item.productId);
      }
    }

    return order;
  },

  async updateTransferStatus(id: string, status: string) {
    const updates: Record<string, any> = { status };
    if (status === "enviado") updates.sent_at = new Date().toISOString();
    if (status === "recebido_full") updates.received_at = new Date().toISOString();
    if (status === "conferido_full") updates.confirmed_at = new Date().toISOString();

    const { error } = await supabase.from("transfer_orders").update(updates as any).eq("id", id);
    if (error) throw error;
  }
};
