import { supabase } from "@/integrations/supabase/client";
import { stockService } from "@/services/stock";

export type ReturnStatus = "pendente" | "em_conferencia" | "aguardando_decisao" | "concluida" | "cancelada";
export type ReturnSource = "mercado_livre" | "loja" | "manual" | "pdv";
export type ItemCondition = "aprovado" | "avariado" | "errado" | "incompleto" | "embalagem_violada" | "outro";
export type QuarantineStatus = "em_quarentena" | "liberado" | "descartado";

export interface Return {
  id: string;
  company_id: string;
  numero: string;
  source: ReturnSource;
  external_id: string | null;
  status: ReturnStatus;
  customer_name: string | null;
  customer_document: string | null;
  order_reference: string | null;
  motivo: string | null;
  valor_total: number | null;
  responsavel_id: string | null;
  received_at: string | null;
  concluded_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReturnItem {
  id: string;
  return_id: string;
  company_id: string;
  product_id: string | null;
  sku: string | null;
  ean: string | null;
  nome_produto: string | null;
  expected_quantity: number;
  received_quantity: number;
  condition: ItemCondition | null;
  decision: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const returnsService = {
  async list(companyId: string, status?: ReturnStatus) {
    let q = (supabase as any)
      .from("returns")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Return[];
  },

  async get(id: string) {
    const { data, error } = await (supabase as any)
      .from("returns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as Return | null;
  },

  async listItems(returnId: string) {
    const { data, error } = await (supabase as any)
      .from("return_items")
      .select("*")
      .eq("return_id", returnId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ReturnItem[];
  },

  async listActions(returnId: string) {
    const { data, error } = await (supabase as any)
      .from("return_actions")
      .select("*")
      .eq("return_id", returnId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listEvidence(returnId: string) {
    const { data, error } = await (supabase as any)
      .from("return_evidence")
      .select("*")
      .eq("return_id", returnId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listQuarantine(companyId: string, status: QuarantineStatus = "em_quarentena") {
    const { data, error } = await (supabase as any)
      .from("quarantine_stock")
      .select("*, products(id, name, sku, barcode)")
      .eq("company_id", companyId)
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: {
    companyId: string;
    source?: ReturnSource;
    externalId?: string;
    customerName?: string;
    orderReference?: string;
    motivo?: string;
    items: { productId?: string; sku?: string; ean?: string; nome?: string; quantity: number }[];
  }) {
    const numero = `DEV-${Date.now().toString(36).toUpperCase()}`;
    const { data: { user } } = await supabase.auth.getUser();

    const { data: ret, error } = await (supabase as any)
      .from("returns")
      .insert({
        company_id: input.companyId,
        numero,
        source: input.source ?? "manual",
        external_id: input.externalId ?? null,
        customer_name: input.customerName ?? null,
        order_reference: input.orderReference ?? null,
        motivo: input.motivo ?? null,
        created_by: user?.id ?? null,
        status: "pendente",
      })
      .select()
      .single();
    if (error) throw error;

    if (input.items.length > 0) {
      const rows = input.items.map(i => ({
        return_id: ret.id,
        company_id: input.companyId,
        product_id: i.productId ?? null,
        sku: i.sku ?? null,
        ean: i.ean ?? null,
        nome_produto: i.nome ?? null,
        expected_quantity: i.quantity,
      }));
      const { error: itemsErr } = await (supabase as any).from("return_items").insert(rows);
      if (itemsErr) throw itemsErr;
    }

    await this.logAction(ret.id, input.companyId, "created", { numero });
    return ret as Return;
  },

  async logAction(returnId: string, companyId: string, action: string, details: any = {}) {
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as any).from("return_actions").insert({
      return_id: returnId,
      company_id: companyId,
      user_id: user?.id ?? null,
      action,
      details,
    });
  },

  async updateStatus(returnId: string, status: ReturnStatus, companyId: string) {
    const patch: any = { status };
    if (status === "em_conferencia") patch.received_at = new Date().toISOString();
    if (status === "concluida") patch.concluded_at = new Date().toISOString();
    const { error } = await (supabase as any).from("returns").update(patch).eq("id", returnId);
    if (error) throw error;
    await this.logAction(returnId, companyId, `status:${status}`);
  },

  async updateItem(itemId: string, patch: Partial<ReturnItem>) {
    const { error } = await (supabase as any).from("return_items").update(patch).eq("id", itemId);
    if (error) throw error;
  },

  async bipItem(returnId: string, code: string, companyId: string) {
    // find matching return_item by ean/sku
    const { data: items } = await (supabase as any)
      .from("return_items")
      .select("*")
      .eq("return_id", returnId);
    const item = (items ?? []).find(
      (i: any) => i.ean === code || i.sku === code
    );
    if (!item) return null;
    const newQty = (item.received_quantity ?? 0) + 1;
    await this.updateItem(item.id, { received_quantity: newQty });
    await this.logAction(returnId, companyId, "item_bip", { item_id: item.id, qty: newQty });
    return { ...item, received_quantity: newQty } as ReturnItem;
  },

  /**
   * Processa decisão de um item:
   * - aprovado → volta ao estoque físico
   * - qualquer outra condição → quarentena
   */
  async processItemDecision(params: {
    returnItemId: string;
    returnId: string;
    companyId: string;
    condition: ItemCondition;
    quantity: number;
    notes?: string;
  }) {
    const { returnItemId, returnId, companyId, condition, quantity, notes } = params;

    // Update item
    await this.updateItem(returnItemId, {
      condition,
      decision: condition === "aprovado" ? "estoque" : "quarentena",
      notes: notes ?? null,
    });

    // Fetch item
    const { data: item } = await (supabase as any)
      .from("return_items")
      .select("*")
      .eq("id", returnItemId)
      .maybeSingle();
    if (!item) throw new Error("Item não encontrado");

    if (condition === "aprovado" && item.product_id && quantity > 0) {
      // Retorno ao estoque físico
      const { data: prod } = await supabase
        .from("products")
        .select("stock_physical")
        .eq("id", item.product_id)
        .maybeSingle();
      const oldStock = prod?.stock_physical ?? 0;
      const newStock = oldStock + quantity;
      await supabase.from("products").update({ stock_physical: newStock }).eq("id", item.product_id);
      await stockService.logMovement({
        productId: item.product_id,
        companyId,
        type: "entrada",
        quantity,
        oldStock,
        newStock,
        stockType: "physical",
        referenceId: returnId,
        referenceType: "manual",
        notes: `Devolução aprovada (${item.nome_produto ?? ""})`,
      });
    } else {
      // Envia para quarentena
      await (supabase as any).from("quarantine_stock").insert({
        company_id: companyId,
        product_id: item.product_id,
        return_id: returnId,
        return_item_id: returnItemId,
        quantity,
        condition,
        status: "em_quarentena",
        reason: notes ?? null,
      });
    }

    await this.logAction(returnId, companyId, "item_decision", {
      item_id: returnItemId,
      condition,
      quantity,
    });
  },

  async releaseQuarantine(params: {
    quarantineId: string;
    companyId: string;
    destination: "estoque" | "descarte";
    notes?: string;
  }) {
    const { quarantineId, companyId, destination, notes } = params;
    const { data: q } = await (supabase as any)
      .from("quarantine_stock")
      .select("*")
      .eq("id", quarantineId)
      .maybeSingle();
    if (!q) throw new Error("Item de quarentena não encontrado");

    const { data: { user } } = await supabase.auth.getUser();

    if (destination === "estoque" && q.product_id && q.quantity > 0) {
      const { data: prod } = await supabase
        .from("products")
        .select("stock_physical")
        .eq("id", q.product_id)
        .maybeSingle();
      const oldStock = prod?.stock_physical ?? 0;
      const newStock = oldStock + q.quantity;
      await supabase.from("products").update({ stock_physical: newStock }).eq("id", q.product_id);
      await stockService.logMovement({
        productId: q.product_id,
        companyId,
        type: "entrada",
        quantity: q.quantity,
        oldStock,
        newStock,
        stockType: "physical",
        referenceId: q.return_id,
        referenceType: "manual",
        notes: `Liberação de quarentena${notes ? " — " + notes : ""}`,
      });
    }

    await (supabase as any).from("quarantine_stock").update({
      status: destination === "estoque" ? "liberado" : "descartado",
      released_at: new Date().toISOString(),
      released_by: user?.id ?? null,
      released_to: destination,
      notes: notes ?? null,
    }).eq("id", quarantineId);
  },

  async uploadEvidence(params: {
    returnId: string;
    returnItemId?: string;
    companyId: string;
    file: File;
    kind?: string;
    caption?: string;
  }) {
    const { returnId, returnItemId, companyId, file, kind, caption } = params;
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${companyId}/${returnId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("return-evidence").upload(path, file);
    if (upErr) throw upErr;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("return_evidence").insert({
      return_id: returnId,
      return_item_id: returnItemId ?? null,
      company_id: companyId,
      storage_path: path,
      bucket: "return-evidence",
      kind: kind ?? "photo",
      caption: caption ?? null,
      uploaded_by: user?.id ?? null,
    });
    if (error) throw error;
    await this.logAction(returnId, companyId, "evidence_uploaded", { path });
  },

  async signedUrl(path: string, bucket = "return-evidence") {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },
};
