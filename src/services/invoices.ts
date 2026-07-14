import { supabase } from "@/integrations/supabase/client";
import type { MatchResult, NFeSupplier } from "@/lib/nfe-parser";
import { enrichProduct } from "@/lib/enrich-product";
import { stockService } from "./stock";

export interface InvoiceStockProcessSummary {
  invoice: any;
  createdCount: number;
  updatedCount: number;
  pendingCount: number;
  skippedCount: number;
}

const toStockQuantity = (quantity: number | string | null | undefined) =>
  Math.floor(Number(quantity) || 0);

const roundMoney = (value: number) => Math.round(value * 100) / 100;

async function findProductBySafeGtin(companyId: string, ean: string): Promise<string | null> {
  const normalizedEan = (ean || "").trim();
  if (!normalizedEan) return null;

  const { data: byEan } = await supabase
    .from("products")
    .select("id")
    .eq("company_id", companyId)
    .eq("ean", normalizedEan)
    .maybeSingle();
  if (byEan?.id) return byEan.id;

  const { data: byBarcode } = await supabase
    .from("products")
    .select("id")
    .eq("company_id", companyId)
    .eq("barcode", normalizedEan)
    .maybeSingle();
  if (byBarcode?.id) return byBarcode.id;

  const { data: byAltGtin } = await supabase
    .from("product_alternative_gtins")
    .select("product_id")
    .eq("company_id", companyId)
    .eq("gtin", normalizedEan)
    .maybeSingle();

  return byAltGtin?.product_id || null;
}

async function createProductFromMatch(params: {
  match: MatchResult;
  nfeNumber: string;
  companyId: string;
}) {
  const { match, nfeNumber, companyId } = params;
  const xmlP = match.xmlProduct;
  const sku = xmlP.code || `XML-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const cost = Number(xmlP.unitValue) || 0;
  const markup = 1.5;
  let enrichedData: any = {};

  try {
    enrichedData = await enrichProduct({
      productName: xmlP.description,
      ean: match.newEan || xmlP.ean || undefined,
      ncm: xmlP.ncm || undefined,
      unit: xmlP.unit || undefined,
    });
  } catch {}

  const description = enrichedData.description
    || `Importado via NF-e ${nfeNumber} | NCM: ${xmlP.ncm || "—"} | Unidade: ${xmlP.unit || "UN"}`;
  const price = enrichedData.suggested_price_brl
    ? enrichedData.suggested_price_brl
    : roundMoney(cost * markup);

  const { data: newProduct, error: prodError } = await supabase
    .from("products")
    .insert({
      sku,
      barcode: match.newEan || xmlP.ean || null,
      ean: match.newEan || xmlP.ean || null,
      name: xmlP.description,
      description,
      cost,
      price,
      stock_physical: toStockQuantity(xmlP.quantity),
      min_stock: 1,
      active: true,
      ean_pending: match.eanPending ?? false,
      weight: enrichedData.weight_kg ?? null,
      width: enrichedData.width_cm ?? null,
      height: enrichedData.height_cm ?? null,
      depth: enrichedData.depth_cm ?? null,
      company_id: companyId,
    })
    .select()
    .eq("company_id", companyId)
    .maybeSingle();

  if (prodError) throw prodError;
  if (!newProduct?.id) throw new Error("Produto novo não foi criado");
  return newProduct;
}

async function createProductFromInvoiceItem(params: {
  item: any;
  invoiceNumber: string;
  companyId: string;
}) {
  const { item, invoiceNumber, companyId } = params;
  const ean = (item.xml_ean || "").trim();
  const sku = (item.xml_code || `NF-${invoiceNumber}-${Math.random().toString(36).slice(2, 6)}`).trim();
  const xmlUnit = Number(item.unit_value) || 0;

  const { data: createdProd, error } = await supabase
    .from("products")
    .insert({
      name: (item.xml_description || "Produto sem nome").slice(0, 200),
      sku,
      barcode: ean || null,
      ean: ean || null,
      cost: xmlUnit,
      price: xmlUnit > 0 ? roundMoney(xmlUnit * 1.5) : 0,
      stock_physical: toStockQuantity(item.quantity),
      min_stock: 0,
      active: true,
      company_id: companyId,
    })
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!createdProd?.id) throw new Error("Produto novo não foi criado");
  return createdProd;
}

async function updateExistingProductStock(params: {
  productId: string;
  companyId: string;
  quantity: number;
  unitValue: number;
  invoiceId: string;
  invoiceNumber: string;
  itemId?: string;
  matchType?: string;
  updateCostOnlyWhenEmpty?: boolean;
}) {
  const { productId, companyId, quantity, unitValue, invoiceId, invoiceNumber, itemId, matchType, updateCostOnlyWhenEmpty } = params;

  const { data: current, error: fetchError } = await supabase
    .from("products")
    .select("stock_physical, cost, barcode, ean, name, description, price, min_stock, ean_pending")
    .eq("id", productId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!current) throw new Error("Produto não encontrado");

  const oldStock = Number(current.stock_physical || 0);
  const newStock = oldStock + quantity;
  const currentCost = Number(current.cost || 0);

  const updates: Record<string, any> = {
    stock_physical: newStock,
    updated_at: new Date().toISOString(),
  };

  if (updateCostOnlyWhenEmpty) {
    if (currentCost === 0 && unitValue > 0) updates.cost = roundMoney(unitValue);
  } else {
    const totalOldCost = oldStock * currentCost;
    const totalNewCost = quantity * unitValue;
    const avgCost = newStock > 0 ? (totalOldCost + totalNewCost) / newStock : unitValue;
    updates.cost = roundMoney(avgCost);
  }

  if ((current.price === 0 || !current.price) && unitValue > 0) {
    updates.price = roundMoney(unitValue * 1.5);
  }
  if (current.min_stock === 0 || current.min_stock === null) {
    updates.min_stock = 1;
  }

  const { error: prodUpdateError } = await supabase
    .from("products")
    .update(updates as any)
    .eq("id", productId)
    .eq("company_id", companyId);

  if (prodUpdateError) throw prodUpdateError;

  if (itemId) {
    const itemUpdates: Record<string, any> = {
      product_id: productId,
      stock_updated: true,
    };
    if (matchType) itemUpdates.match_type = matchType;

    const { error: itemUpdateErr } = await supabase
      .from("invoice_items")
      .update(itemUpdates as any)
      .eq("id", itemId);

    if (itemUpdateErr) throw itemUpdateErr;
  }

  await stockService.logMovement({
    productId,
    companyId,
    type: "entrada",
    quantity,
    oldStock,
    newStock,
    stockType: "physical",
    referenceId: invoiceId,
    referenceType: "invoice",
    notes: `Entrada via NF-e ${invoiceNumber}`,
  });
}

async function markCreatedItemProcessed(params: {
  itemId: string;
  productId: string;
  companyId: string;
  quantity: number;
  invoiceId: string;
  invoiceNumber: string;
}) {
  const { itemId, productId, companyId, quantity, invoiceId, invoiceNumber } = params;

  const { error: itemUpdateErr } = await supabase
    .from("invoice_items")
    .update({
      product_id: productId,
      stock_updated: true,
      match_type: "new",
    })
    .eq("id", itemId);

  if (itemUpdateErr) throw itemUpdateErr;

  await stockService.logMovement({
    productId,
    companyId,
    type: "entrada",
    quantity,
    oldStock: 0,
    newStock: quantity,
    stockType: "physical",
    referenceId: invoiceId,
    referenceType: "invoice",
    notes: `Entrada via NF-e ${invoiceNumber}`,
  });
}

export const invoicesService = {
  async fetchInvoices(companyId: string | null) {
    if (!companyId) return [];
    let query = supabase
      .from("invoices")
      .select("*, invoice_items(*, products(id, name, sku))")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async fetchInvoiceStats(companyId: string | null) {
    if (!companyId) return { total: 0, importada: 0, aguardando: 0, conferida: 0, divergente: 0 };
    const { data, error } = await supabase
      .from("invoices")
      .select("status")
      .eq("company_id", companyId);
    if (error) throw error;
    return {
      total: data.length,
      importada: data.filter((i) => i.status === "importada").length,
      aguardando: data.filter((i) => i.status === "aguardando_conferencia").length,
      conferida: data.filter((i) => i.status === "conferida").length,
      divergente: data.filter((i) => i.status === "divergente").length,
    };
  },

  async importInvoice(params: {
    nfeData: {
      number: string;
      series: string;
      issuerName: string;
      issuerCnpj: string;
      totalValue: number;
      supplier?: NFeSupplier;
    };
    matches: MatchResult[];
    createNewProducts: boolean;
    companyId: string;
  }): Promise<InvoiceStockProcessSummary> {
    const { nfeData, matches, createNewProducts, companyId } = params;
    if (!companyId) throw new Error("companyId é obrigatório");

    // Verificar se a nota já foi importada (evitar duplicação de estoque)
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id, status")
      .eq("number", nfeData.number)
      .eq("series", nfeData.series)
      .eq("issuer_cnpj", nfeData.issuerCnpj)
      .eq("company_id", companyId)
      .maybeSingle();

    if (existingInvoice) {
      throw new Error(`Nota fiscal ${nfeData.number} série ${nfeData.series} do CNPJ ${nfeData.issuerCnpj} já foi importada anteriormente.`);
    }

    let supplierId: string | null = null;

    if (nfeData.supplier) {
      const { data: existing } = await supabase
        .from("suppliers")
        .select("id, razao_social")
        .eq("cnpj", nfeData.supplier.cnpj)
        .eq("company_id", companyId)
        .maybeSingle();

      if (existing) {
        const { error: updError } = await supabase.from("suppliers").update({
          ...nfeData.supplier,
          updated_at: new Date().toISOString(),
        } as any).eq("id", existing.id).eq("company_id", companyId);
        if (updError) throw updError;
        supplierId = existing.id;
      } else {
        const { data: novo, error: insError } = await supabase.from("suppliers").insert({
          ...nfeData.supplier,
          company_id: companyId,
          origem: "nota_fiscal",
          created_at: new Date().toISOString(),
        } as any).select().maybeSingle();
        if (insError) throw insError;
        if (novo) supplierId = novo.id;
      }
    }

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .insert({
        number: nfeData.number,
        series: nfeData.series,
        issuer_name: nfeData.issuerName,
        issuer_cnpj: nfeData.issuerCnpj,
        total_value: nfeData.totalValue,
        status: "aguardando_conferencia",
        items_count: matches.length,
        company_id: companyId,
        supplier_id: supplierId,
      })
      .select()
      .maybeSingle();
    if (invError) throw invError;
    if (!invoice?.id) throw new Error("Nota fiscal não foi criada");

    let createdCount = 0;
    let updatedCount = 0;
    let pendingCount = 0;
    let skippedCount = 0;

    for (const match of matches) {
      const xmlP = match.xmlProduct;
      const qty = toStockQuantity(xmlP.quantity);
      let productId = match.matchedProductId;
      let productCreatedDuringImport = false;

      try {
        if (!productId && createNewProducts) {
          const newProduct = await createProductFromMatch({ match, nfeNumber: nfeData.number, companyId });
          productId = newProduct.id;
          productCreatedDuringImport = true;
        }

        const { data: insertedItem, error: itemError } = await supabase.from("invoice_items").insert({
          invoice_id: invoice.id,
          product_id: productId,
          xml_code: xmlP.code,
          xml_description: xmlP.description,
          xml_ean: xmlP.ean || match.newEan || "",
          xml_ncm: xmlP.ncm || "",
          xml_cfop: xmlP.cfop || "",
          xml_unit: xmlP.unit || "UN",
          quantity: xmlP.quantity,
          unit_value: xmlP.unitValue,
          total_value: xmlP.totalValue,
          match_type: productId ? (productCreatedDuringImport ? "new" : (match.matchType || "manual")) : "none",
          match_confidence: match.confidence,
          stock_updated: productCreatedDuringImport,
        }).select().maybeSingle();

        if (itemError) throw itemError;

        if (qty <= 0) {
          skippedCount++;
          continue;
        }

        if (productId && productCreatedDuringImport) {
          await markCreatedItemProcessed({
            itemId: insertedItem.id,
            productId,
            companyId,
            quantity: qty,
            invoiceId: invoice.id,
            invoiceNumber: nfeData.number,
          });
          createdCount++;
        } else if (productId) {
          await updateExistingProductStock({
            productId,
            companyId,
            quantity: qty,
            unitValue: Number(xmlP.unitValue) || 0,
            invoiceId: invoice.id,
            invoiceNumber: nfeData.number,
            itemId: insertedItem.id,
          });
          updatedCount++;
        } else {
          pendingCount++;
        }

        if (productId && supplierId) {
          await supabase.from("product_supplier_skus").upsert({
            product_id: productId,
            supplier_id: supplierId,
            supplier_name: nfeData.issuerName,
            supplier_sku: xmlP.code,
            company_id: companyId,
            supplier_cnpj: nfeData.issuerCnpj,
          } as any, { onConflict: "product_id,supplier_id" });
        }
      } catch (error) {
        console.error("Erro ao processar item da NF-e:", error);
        skippedCount++;
      }
    }

    const finalStatus = pendingCount === 0 && skippedCount === 0 ? "importada" : "aguardando_conferencia";
    const { data: updatedInvoice, error: statusErr } = await supabase
      .from("invoices")
      .update({ status: finalStatus })
      .eq("id", invoice.id)
      .eq("company_id", companyId)
      .select()
      .maybeSingle();
    if (statusErr) throw statusErr;

    return {
      invoice: updatedInvoice || { ...invoice, status: finalStatus },
      createdCount,
      updatedCount,
      pendingCount,
      skippedCount,
    };
  },

  async reprocessInvoiceStock(invoiceId: string, companyId: string): Promise<InvoiceStockProcessSummary & { pendingCount: number }> {
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", invoiceId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) throw error;
    if (!inv) return { invoice: null, createdCount: 0, updatedCount: 0, skippedCount: 0, pendingCount: 0 };

    const pending = ((inv.invoice_items as any[]) || []).filter(
      (it: any) => !it.product_id || !it.stock_updated
    );
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const it of pending) {
      const ean = (it.xml_ean || "").trim();
      const qty = toStockQuantity(it.quantity);
      if (qty <= 0) {
        skippedCount++;
        continue;
      }

      try {
        let productId: string | null = it.product_id || null;

        if (!productId && ean) {
          productId = await findProductBySafeGtin(companyId, ean);
        }

        // Verificar se já existe movimentação de estoque para este item (evitar duplicação)
        if (productId) {
          const { data: existingMovement } = await supabase
            .from("stock_movement_logs")
            .select("id")
            .eq("product_id", productId)
            .eq("reference_id", inv.id)
            .eq("reference_type", "invoice")
            .eq("company_id", companyId)
            .limit(1);

          if (existingMovement && existingMovement.length > 0) {
            // Já processado anteriormente — apenas marcar o item como atualizado
            await supabase
              .from("invoice_items")
              .update({ product_id: productId, stock_updated: true } as any)
              .eq("id", it.id);
            updatedCount++;
            continue;
          }
        }

        if (!productId) {
          const createdProd = await createProductFromInvoiceItem({
            item: it,
            invoiceNumber: inv.number,
            companyId,
          });
          productId = createdProd.id;

          await markCreatedItemProcessed({
            itemId: it.id,
            productId,
            companyId,
            quantity: qty,
            invoiceId: inv.id,
            invoiceNumber: inv.number,
          });
          createdCount++;
        } else if (!it.stock_updated) {
          await updateExistingProductStock({
            productId,
            companyId,
            quantity: qty,
            unitValue: Number(it.unit_value) || 0,
            invoiceId: inv.id,
            invoiceNumber: inv.number,
            itemId: it.id,
            matchType: it.match_type === "none" ? "exact" : it.match_type,
            updateCostOnlyWhenEmpty: true,
          });
          updatedCount++;
        }
      } catch (err) {
        console.error("Erro ao reprocessar item da NF-e:", err);
        skippedCount++;
      }
    }

    const remainingPending = Math.max(pending.length - createdCount - updatedCount, 0);
    const finalStatus = remainingPending === 0 && skippedCount === 0 ? "importada" : "aguardando_conferencia";
    const { data: updatedInvoice, error: invErr } = await supabase
      .from("invoices")
      .update({ status: finalStatus })
      .eq("id", inv.id)
      .eq("company_id", companyId)
      .select()
      .maybeSingle();
    if (invErr) throw invErr;

    return {
      invoice: updatedInvoice || { ...inv, status: finalStatus },
      createdCount,
      updatedCount,
      skippedCount,
      pendingCount: remainingPending,
    };
  },

  async confirmarEntrada(id: string, companyId: string) {
    const { error } = await supabase
      .from("invoices")
      .update({ status: "conferida" })
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw error;
  },

  async excluirNota(id: string, companyId: string) {
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) throw error;
  }
};
