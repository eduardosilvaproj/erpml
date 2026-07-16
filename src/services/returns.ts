import { supabase } from "@/integrations/supabase/client";

export interface ReturnData {
  id: string;
  company_id: string;
  created_at: string;
  updated_at: string;
  ml_return_id: string | null;
  ml_order_id: string | null;
  ml_claim_id: string | null;
  status: string;
  source: string;
  motivo: string | null;
  classification: string | null;
  classification_reason: string | null;
  classification_notes: string | null;
  refund_amount: number | null;
  ml_refund_id: string | null;
  recebido_em: string | null;
  conferencia_iniciada_em: string | null;
  conferencia_finalizada_em: string | null;
  decisions_made_by: string | null;
  operador_id: string | null;
  operador_recebimento_id: string | null;
  created_by: string | null;
  notes: string | null;
  external_reference: string | null;
  bipagem_state: any[];
  return_items?: ReturnItemData[];
  return_actions?: ReturnActionData[];
}

export interface ReturnItemData {
  id: string;
  return_id: string;
  company_id: string;
  product_id: string | null;
  ml_item_id: string | null;
  sku: string | null;
  nome_produto: string | null;
  expected_quantity: number;
  received_quantity: number;
  approved_quantity: number;
  status: string;
  condition: string | null;
  condition_notes: string | null;
  bipagem_state: any[];
  created_at: string;
  updated_at: string;
  products?: { id: string; name: string; sku: string; ean: string | null; barcode: string | null; stock_physical: number; image_url: string | null };
}

export interface ReturnActionData {
  id: string;
  return_id: string;
  company_id: string;
  action: string;
  description: string | null;
  user_id: string | null;
  user_name: string | null;
  metadata: any;
  created_at: string;
}

export interface ReturnEvidenceData {
  id: string;
  return_id: string;
  company_id: string;
  type: string;
  storage_path: string | null;
  public_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  duration_seconds: number | null;
  recorded_at: string | null;
  recorded_by: string | null;
  description: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface QuarantineData {
  id: string;
  company_id: string;
  product_id: string;
  quantity: number;
  source_type: string;
  source_id: string | null;
  status: string;
  reason: string | null;
  inspection_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  products?: { id: string; name: string; sku: string; ean: string | null; barcode: string | null };
}

export interface CreateReturnParams {
  ml_order_id?: string;
  ml_return_id?: string;
  motivo?: string;
  source?: string;
  notes?: string;
  items: { product_id: string; nome_produto: string; sku?: string; expected_quantity: number }[];
}

export const returnsService = {
  async fetchReturns(companyId: string, filters?: { status?: string; search?: string }) {
    let query = supabase
      .from("returns")
      .select("*, return_items(*, products(id, name, sku, ean, barcode, stock_physical, image_url))")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as ReturnData[];
  },

  async fetchReturn(returnId: string, companyId: string) {
    const { data, error } = await supabase
      .from("returns")
      .select("*, return_items(*, products(id, name, sku, ean, barcode, stock_physical, image_url)), return_actions(*, profiles(full_name))")
      .eq("id", returnId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw error;
    return data as unknown as ReturnData;
  },

  async fetchReturnActions(returnId: string) {
    const { data, error } = await supabase
      .from("return_actions")
      .select("*, profiles(full_name)")
      .eq("return_id", returnId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []) as unknown as ReturnActionData[];
  },

  async fetchReturnEvidence(returnId: string) {
    const { data, error } = await supabase
      .from("return_evidence")
      .select("*")
      .eq("return_id", returnId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as ReturnEvidenceData[];
  },

  async createReturn(params: CreateReturnParams, companyId: string, userId: string) {
    const { items, ...returnData } = params;

    const { data: ret, error } = await supabase
      .from("returns")
      .insert({
        ml_order_id: returnData.ml_order_id || null,
        ml_return_id: returnData.ml_return_id || null,
        motivo: returnData.motivo || null,
        source: (returnData.source || "manual") as any,
        notes: returnData.notes || null,
        status: "pendente_recebimento",
        company_id: companyId,
        created_by: userId,
      })
      .select()
      .maybeSingle();
    if (error) throw error;

    if (items.length > 0 && ret) {
      const dbItems = items.map((item) => ({
        return_id: ret.id,
        company_id: companyId,
        product_id: item.product_id,
        nome_produto: item.nome_produto,
        sku: item.sku || null,
        expected_quantity: item.expected_quantity,
      }));
      const { error: itemsError } = await supabase.from("return_items").insert(dbItems);
      if (itemsError) throw itemsError;
    }

    await supabase.from("return_actions").insert({
      return_id: ret.id,
      company_id: companyId,
      action: "created",
      description: "Devolução criada manualmente",
      user_id: userId,
      metadata: { source: returnData.source || "manual" },
    });

    return ret;
  },

  async updateReturnStatus(returnId: string, status: string, companyId: string, userId?: string) {
    const update: Record<string, any> = { status };

    if (status === "recebido") update.recebido_em = new Date().toISOString();
    if (status === "em_conferencia") update.conferencia_iniciada_em = new Date().toISOString();
    if (status === "concluida" || status === "aprovada" || status === "recusada") {
      update.conferencia_finalizada_em = new Date().toISOString();
      if (userId) update.decisions_made_by = userId;
    }

    const { error } = await supabase
      .from("returns")
      .update(update as any)
      .eq("id", returnId)
      .eq("company_id", companyId);
    if (error) throw error;

    if (userId) {
      await supabase.from("return_actions").insert({
        return_id: returnId,
        company_id: companyId,
        action: `status_${status}`,
        description: `Status alterado para ${status}`,
        user_id: userId,
        metadata: { new_status: status },
      });
    }
  },

  async classifyItem(itemId: string, condition: string, notes?: string) {
    const { error } = await supabase
      .from("return_items")
      .update({ condition, condition_notes: notes || null, status: "conferido" })
      .eq("id", itemId);
    if (error) throw error;
  },

  async addAction(returnId: string, companyId: string, action: string, description: string, userId?: string, metadata?: any) {
    const { error } = await supabase.from("return_actions").insert({
      return_id: returnId,
      company_id: companyId,
      action,
      description,
      user_id: userId || null,
      metadata: metadata || {},
    });
    if (error) throw error;
  },

  async addEvidence(returnId: string, companyId: string, params: {
    type: string; storage_path: string; file_name?: string; file_size?: number;
    mime_type?: string; duration_seconds?: number; description?: string; tags?: string[];
  }) {
    const { error } = await supabase.from("return_evidence").insert({
      return_id: returnId,
      company_id: companyId,
      type: params.type,
      storage_path: params.storage_path,
      file_name: params.file_name || null,
      file_size: params.file_size || null,
      mime_type: params.mime_type || null,
      duration_seconds: params.duration_seconds || null,
      description: params.description || null,
      tags: params.tags || null,
      recorded_at: new Date().toISOString(),
    });
    if (error) throw error;
  },

  async fetchQuarantineItems(companyId: string, filters?: { status?: string }) {
    let query = supabase
      .from("quarantine_stock")
      .select("*, products(id, name, sku, ean, barcode)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (filters?.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as QuarantineData[];
  },

  async releaseQuarantine(quarantineId: string, companyId: string) {
    const { data: item, error: fetchError } = await supabase
      .from("quarantine_stock")
      .select("*, products(id, name, stock_physical)")
      .eq("id", quarantineId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (fetchError || !item) throw fetchError || new Error("Item não encontrado");

    const product = (item as any).products;
    const newStock = (product?.stock_physical || 0) + item.quantity;

    const { error: stockError } = await supabase
      .from("products")
      .update({ stock_physical: newStock })
      .eq("id", item.product_id)
      .eq("company_id", companyId);
    if (stockError) throw stockError;

    const { error: updateError } = await supabase
      .from("quarantine_stock")
      .update({ status: "released", resolved_at: new Date().toISOString(), resolution: "returned_to_stock" })
      .eq("id", quarantineId);
    if (updateError) throw updateError;
  },

  async discardQuarantine(quarantineId: string, reason: string) {
    const { error } = await supabase
      .from("quarantine_stock")
      .update({ status: "discarded", resolved_at: new Date().toISOString(), resolution: reason })
      .eq("id", quarantineId);
    if (error) throw error;
  },
};