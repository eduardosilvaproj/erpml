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
    
    const { error: logErr } = await supabase.from("stock_movement_logs").insert({
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
    if (logErr) console.error("Erro ao registrar log de estoque:", logErr.message);
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

  async fetchTransferOrders(companyId: string) {
    if (!companyId) throw new Error("companyId é obrigatório");

    const { data, error } = await supabase
      .from("transfer_orders")
      .select("*, transfer_items(*, products(id, name, sku, barcode))")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  async createTransferOrder(params: {
    items: any[];
    notes?: string;
    companyId: string;
  }) {
    const { items, notes, companyId } = params;
    if (!companyId) throw new Error("companyId é obrigatório");

    // Check stock first
    for (const item of items) {
      const { data: product } = await supabase
        .from("products")
        .select("stock_physical")
        .eq("id", item.productId)
        .eq("company_id", companyId)
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
    const { error: tiErr } = await supabase.from("transfer_items").insert(transferItems);
    if (tiErr) throw tiErr;

    for (const item of items) {
      const { data: current } = await supabase
        .from("products")
        .select("stock_physical, stock_full")
        .eq("id", item.productId)
        .eq("company_id", companyId)
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
          .eq("id", item.productId)
          .eq("company_id", companyId);

        await this.logMovement({
          productId: item.productId,
          companyId: companyId,
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
          companyId: companyId,
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
  },

  /**
   * Reconcilia o estoque de todos os produtos da empresa.
   * Recalcula stock_physical baseado nas invoice_items (stock_updated=true)
   * e desconta as saídas/transferências registradas em stock_movement_logs.
   * stock_full é recalculado pelas transferências registradas.
   *
   * Retorna um relatório com os produtos corrigidos.
   */
  async reconcileStock(companyId: string): Promise<{
    total: number;
    corrected: number;
    details: { productId: string; name: string; oldPhysical: number; newPhysical: number; oldFull: number; newFull: number }[];
  }> {
    if (!companyId) throw new Error("companyId é obrigatório");

    // Buscar todos os produtos da empresa
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, stock_physical, stock_full")
      .eq("company_id", companyId);

    if (prodErr) throw prodErr;
    if (!products || products.length === 0) return { total: 0, corrected: 0, details: [] };

    const details: { productId: string; name: string; oldPhysical: number; newPhysical: number; oldFull: number; newFull: number }[] = [];
    let corrected = 0;

    for (const product of products) {
      // 1. Somar todas as entradas via invoice_items (stock_updated = true)
      const { data: invoiceEntries, error: invErr } = await supabase
        .from("invoice_items")
        .select("quantity")
        .eq("product_id", product.id)
        .eq("stock_updated", true);

      if (invErr) {
        console.error(`Erro ao buscar invoice_items do produto ${product.id}:`, invErr.message);
        continue;
      }

      let totalEntradas = 0;
      for (const entry of (invoiceEntries || [])) {
        totalEntradas += Math.floor(Number(entry.quantity) || 0);
      }

      // 2. Buscar saídas e transferências dos logs
      const { data: movements, error: movErr } = await supabase
        .from("stock_movement_logs")
        .select("type, quantity, stock_type")
        .eq("product_id", product.id)
        .eq("company_id", companyId);

      if (movErr) {
        console.error(`Erro ao buscar movimentos do produto ${product.id}:`, movErr.message);
        continue;
      }

      let totalSaidas = 0;
      let totalTransferenciasParaFull = 0;
      let totalSaidasFull = 0;

      for (const mov of (movements || [])) {
        const qty = Math.abs(mov.quantity || 0);

        if (mov.stock_type === "physical") {
          if (mov.type === "saida") {
            totalSaidas += qty;
          } else if (mov.type === "transferencia") {
            totalTransferenciasParaFull += qty;
          }
        } else if (mov.stock_type === "full") {
          if (mov.type === "saida") {
            totalSaidasFull += qty;
          }
        }
      }

      // 3. Calcular estoque correto
      const calculatedPhysical = Math.max(0, totalEntradas - totalSaidas - totalTransferenciasParaFull);
      const calculatedFull = Math.max(0, totalTransferenciasParaFull - totalSaidasFull);

      const currentPhysical = product.stock_physical || 0;
      const currentFull = product.stock_full || 0;

      // Se há diferença, corrigir
      if (calculatedPhysical !== currentPhysical || calculatedFull !== currentFull) {
        const { error: updateErr } = await supabase
          .from("products")
          .update({
            stock_physical: calculatedPhysical,
            stock_full: calculatedFull,
            updated_at: new Date().toISOString(),
          })
          .eq("id", product.id)
          .eq("company_id", companyId);

        if (!updateErr) {
          details.push({
            productId: product.id,
            name: product.name || "Sem nome",
            oldPhysical: currentPhysical,
            newPhysical: calculatedPhysical,
            oldFull: currentFull,
            newFull: calculatedFull,
          });
          corrected++;
        }
      }
    }

    return { total: products.length, corrected, details };
  },

  /**
   * Reconcilia o estoque de TODAS as empresas do sistema.
   * Uso exclusivo do admin master.
   */
  async reconcileAllCompanies(): Promise<{
    companiesProcessed: number;
    totalCorrected: number;
    perCompany: { companyId: string; companyName: string; total: number; corrected: number }[];
  }> {
    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, name");

    if (error) throw error;
    if (!companies || companies.length === 0) return { companiesProcessed: 0, totalCorrected: 0, perCompany: [] };

    const perCompany: { companyId: string; companyName: string; total: number; corrected: number }[] = [];
    let totalCorrected = 0;

    for (const company of companies) {
      try {
        const result = await this.reconcileStock(company.id);
        perCompany.push({
          companyId: company.id,
          companyName: company.name || "Sem nome",
          total: result.total,
          corrected: result.corrected,
        });
        totalCorrected += result.corrected;
      } catch (err) {
        console.error(`Erro ao reconciliar empresa ${company.id}:`, err);
        perCompany.push({
          companyId: company.id,
          companyName: company.name || "Sem nome",
          total: 0,
          corrected: -1,
        });
      }
    }

    return { companiesProcessed: companies.length, totalCorrected, perCompany };
  },
};
