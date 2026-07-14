import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { productsService } from "@/services/products";
import { type NFeProduct, type MatchResult } from "@/lib/nfe-parser";
import { type BatchNfe, type KitGroup } from "../types";

export const useEntradaNotaConfirm = (
  companyId: string | null,
  queryClient: any,
  toast: any,
  state: {
    nfeData: any;
    matches: MatchResult[];
    adjustedItems: MatchResult[];
    autoUpdateStock: boolean;
    autoUpdateCost: boolean;
    isBatchMode: boolean;
    selectedBatchNfes: BatchNfe[];
    batchSelectedForConfirm: Set<string>;
    kitGroups: KitGroup[];
  },
  setSaving: (v: boolean) => void,
  setDone: (v: boolean) => void,
  setBatchConfirmResult: (v: any) => void,
  clearPersistedState: () => void
) => {
  const autoCreateProductFromXml = async (xmlProduct: NFeProduct): Promise<string | null> => {
    if (!companyId) throw new Error("Empresa não identificada");
    const ean = (xmlProduct.ean || "").trim();
    const sku = (xmlProduct.code || `NF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).trim();
    const qty = Math.floor(xmlProduct.quantity);

    if (ean) {
      const existing = await productsService.findProductByEanOrSku({ ean, companyId });
      if (existing?.id) return existing.id;
    }
    
    const existingBySku = await productsService.findProductByEanOrSku({ sku, companyId });
    if (existingBySku?.id) return existingBySku.id;

    const xmlUnit = Number(xmlProduct.unitValue) || 0;
    const suggestedPrice = xmlUnit > 0 ? Math.round(xmlUnit * 1.5 * 100) / 100 : 0;
    
    try {
      const created = await productsService.createProduct({
        name: xmlProduct.description.slice(0, 200),
        sku,
        barcode: ean || null,
        cost: xmlUnit,
        price: suggestedPrice,
        stock_physical: qty,
        min_stock: 0,
        active: true,
      }, companyId);
      
      return created?.id || null;
    } catch (err) {
      console.error("Erro ao criar produto automático:", err);
      return null;
    }
  };

  const confirmarEntrada = async () => {
    // Normalização preventiva dos dados da nota (número e CNPJ)
    if (state.nfeData) {
      // Normalização: remove espaços e zeros à esquerda para comparação consistente
      state.nfeData.number = String(state.nfeData.number || "").trim().replace(/^0+/, "");
      state.nfeData.issuerCnpj = String(state.nfeData.issuerCnpj || "").replace(/\D/g, "");
    }
    
    if (state.isBatchMode) {
      await confirmarEntradaLote();
      return;
    }
    if (!state.nfeData) return;
    setSaving(true);

    try {
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("number", state.nfeData.number)
        .eq("issuer_cnpj", state.nfeData.issuerCnpj)
        .eq("company_id", companyId)
        .maybeSingle();

      if (existing) {
        toast({ title: "Nota já importada", description: `NF-e nº ${state.nfeData.number} já existe.`, variant: "destructive" });
        setSaving(false);
        return;
      }

      const itemsToImport = state.adjustedItems.length > 0 ? state.adjustedItems : state.matches;

      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          number: state.nfeData.number,
          series: state.nfeData.series,
          issuer_cnpj: state.nfeData.issuerCnpj,
          issuer_name: state.nfeData.issuerName,
          total_value: state.nfeData.totalValue,
          status: "conferida",
          items_count: itemsToImport.length,
          company_id: companyId,
        })
        .select()
        .maybeSingle();

      if (invError) {
        if (invError.code === "23505") {
          toast({ title: "Nota já importada", variant: "destructive" });
          setSaving(false);
          return;
        }
        throw invError;
      }

      let itemsSaved = 0;
      let itemsFailed = 0;
      const inKitIdx = new Set<number>(state.kitGroups.flatMap((k) => k.itemIndices));
      const idxToProductId = new Map<number, string>();

      for (let idx = 0; idx < itemsToImport.length; idx++) {
        const match = itemsToImport[idx];
        const isInKit = inKitIdx.has(idx);
        try {
          let productId = match.matchedProductId;

          if (!productId && (state.autoUpdateStock || isInKit)) {
            try {
              productId = await autoCreateProductFromXml(match.xmlProduct, isInKit);
            } catch (err: any) {
              console.error("Erro ao criar produto automaticamente:", err);
              itemsFailed++;
              continue;
            }
          }

          const { data: insertedItem, error: itemError } = await supabase.from("invoice_items").insert({
            invoice_id: invoice.id,
            product_id: productId,
            xml_code: match.xmlProduct.code,
            xml_description: match.xmlProduct.description,
            xml_ean: match.xmlProduct.ean || "",
            xml_ncm: match.xmlProduct.ncm || "",
            xml_cfop: match.xmlProduct.cfop || "",
            xml_unit: match.xmlProduct.unit || "UN",
            quantity: match.xmlProduct.quantity,
            unit_value: match.xmlProduct.unitValue,
            total_value: match.xmlProduct.totalValue,
            match_type: productId ? (match.matchedProductId ? (match.matchType || 'manual') : "new") : "none",
            match_confidence: match.confidence,
            stock_updated: false,
          }).select().maybeSingle();

          if (itemError) {
            console.error("Erro ao inserir item da nota:", itemError);
            itemsFailed++;
            continue;
          }

          if (productId) idxToProductId.set(idx, productId);

          // Skip stock/cost update for kit components — only the kit itself gets stock
          if (productId && match.matchedProductId && state.autoUpdateStock && !isInKit) {
            const { data: current, error: fetchError } = await supabase
              .from("products")
              .select("stock_physical, cost, price")
              .eq("id", productId)
              .eq("company_id", companyId as string)
              .maybeSingle();

            if (!fetchError && current) {
              const qty = Math.floor(match.xmlProduct.quantity);
              const newStock = (Number(current.stock_physical) || 0) + qty;
              const xmlUnit = Number(match.xmlProduct.unitValue) || 0;
              const currentCost = Number(current.cost) || 0;
              const currentPrice = Number(current.price) || 0;

              const update: Record<string, any> = { 
                stock_physical: newStock,
                updated_at: new Date().toISOString()
              };

              if (state.autoUpdateCost) {
                const totalOldCost = (Number(current.stock_physical) || 0) * currentCost;
                const totalNewCost = match.xmlProduct.quantity * xmlUnit;
                const avgCost = newStock > 0 ? (totalOldCost + totalNewCost) / newStock : xmlUnit;
                update.cost = Math.round(avgCost * 100) / 100;
              } else if (currentCost === 0 && xmlUnit > 0) {
                update.cost = Math.round(xmlUnit * 100) / 100;
              }

              if ((currentPrice === 0 || !currentPrice) && xmlUnit > 0) {
                update.price = Math.round(xmlUnit * 1.5 * 100) / 100;
              }

              const { error: updateError } = await supabase
                .from("products")
                .update(update as any)
                .eq("id", productId)
                .eq("company_id", companyId as string);

              if (!updateError) {
                await supabase
                  .from("invoice_items")
                  .update({ stock_updated: true })
                  .eq("id", insertedItem.id);
              }
            }
          } else if (productId && !match.matchedProductId && state.autoUpdateStock && !isInKit) {
            await supabase
              .from("invoice_items")
              .update({ stock_updated: true })
              .eq("id", insertedItem.id);
          }

          if (productId && match.xmlProduct.code) {
            await supabase.from("product_supplier_skus").upsert({
              product_id: productId,
              supplier_name: state.nfeData.issuerName,
              supplier_sku: match.xmlProduct.code,
              supplier_cnpj: state.nfeData.issuerCnpj
            }, { onConflict: 'product_id,supplier_sku' });
          }
          
          itemsSaved++;
        } catch (err) {
          console.error("Erro ao processar item:", err);
          itemsFailed++;
        }
      }

      // Create kits from kitGroups
      for (const kg of state.kitGroups) {
        try {
          const kitItems = kg.itemIndices
            .map((i) => ({ productId: idxToProductId.get(i), qty: Math.floor(itemsToImport[i]?.xmlProduct.quantity || 1) }))
            .filter((k) => !!k.productId);
          if (kitItems.length === 0) continue;

          const { data: kitRow, error: kitErr } = await supabase
            .from("product_kits")
            .insert({
              name: kg.name,
              sku: kg.sku,
              price: kg.price || 0,
              cost: kg.cost,
              stock_physical: kg.quantity,
              active: true,
              company_id: companyId,
            } as any)
            .select()
            .maybeSingle();

          if (kitErr || !kitRow) { console.error("Erro ao criar kit:", kitErr); continue; }

          await supabase.from("kit_items").insert(
            kitItems.map((k) => ({ kit_id: kitRow.id, product_id: k.productId as string, quantity: 1 }))
          );
        } catch (err) {
          console.error("Erro ao criar kit:", err);
        }
      }


      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });

      if (itemsFailed > 0) {
        toast({
          title: "Importação concluída com avisos",
          description: `${itemsSaved} itens salvos. ${itemsFailed} itens sem produto vinculado — clique para revisar.`,
        });
      } else {
        toast({ title: "Nota fiscal importada com sucesso!", description: `${itemsSaved} itens vinculados.` });
      }

      setDone(true);
      clearPersistedState();
    } catch (err: any) {
      console.error("Erro fatal ao confirmar entrada:", err);
      toast({ title: "Erro ao confirmar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmarEntradaLote = async () => {
    setSaving(true);
    let confirmedCount = 0;
    let totalProducts = 0;
    let totalVal = 0;
    let itemsFailedTotal = 0;

    try {
      const nfesToConfirm = state.selectedBatchNfes.filter((n) => state.batchSelectedForConfirm.has(n.id));

      for (const nf of nfesToConfirm) {
        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("number", nf.nfeData.number)
          .eq("issuer_cnpj", nf.nfeData.issuerCnpj)
          .eq("company_id", companyId as string)
          .maybeSingle();

        if (existing) continue;

        const { data: invoice, error: invError } = await supabase
          .from("invoices")
          .insert({
            number: nf.nfeData.number,
            series: nf.nfeData.series,
            issuer_cnpj: nf.nfeData.issuerCnpj,
            issuer_name: nf.nfeData.issuerName,
            total_value: nf.nfeData.totalValue,
            status: "conferida",
            items_count: nf.matches.length,
            company_id: companyId,
          })
          .select()
          .maybeSingle();

        if (invError) continue;

        for (const match of nf.matches) {
          try {
            let productId = match.matchedProductId;
            const wasMatched = !!productId;

            if (!productId && state.autoUpdateStock) {
              try {
                productId = await autoCreateProductFromXml(match.xmlProduct);
              } catch (err: any) {
                console.error(`Erro ao criar produto ${match.xmlProduct.description} no lote:`, err);
                itemsFailedTotal++;
                continue; 
              }
            }

            const { data: insertedItem, error: itemError } = await supabase.from("invoice_items").insert({
              invoice_id: invoice.id,
              product_id: productId,
              xml_code: match.xmlProduct.code,
              xml_description: match.xmlProduct.description,
              xml_ean: match.xmlProduct.ean || "",
              xml_ncm: match.xmlProduct.ncm || "",
              xml_cfop: match.xmlProduct.cfop || "",
              xml_unit: match.xmlProduct.unit || "UN",
              quantity: match.xmlProduct.quantity,
              unit_value: match.xmlProduct.unitValue,
              total_value: match.xmlProduct.totalValue,
              match_type: productId ? (wasMatched ? (match.matchType || 'manual') : "new") : "none",
              match_confidence: match.confidence,
              stock_updated: !wasMatched && !!productId && state.autoUpdateStock,
            }).select().maybeSingle();

            if (itemError) {
              itemsFailedTotal++;
              continue;
            }

            if (productId && wasMatched && state.autoUpdateStock) {
              const { data: current, error: fetchError } = await supabase
                .from("products")
                .select("stock_physical, cost, price")
                .eq("id", productId)
                .eq("company_id", companyId as string)
                .maybeSingle();

              if (!fetchError && current) {
                const qty = Math.floor(match.xmlProduct.quantity);
                const newStock = (Number(current.stock_physical) || 0) + qty;
                const xmlUnit = Number(match.xmlProduct.unitValue) || 0;
                const currentCost = Number(current.cost) || 0;
                const currentPrice = Number(current.price) || 0;

                const update: Record<string, any> = { stock_physical: newStock, updated_at: new Date().toISOString() };

                if (state.autoUpdateCost) {
                  const totalOldCost = (Number(current.stock_physical) || 0) * currentCost;
                  const totalNewCost = match.xmlProduct.quantity * xmlUnit;
                  const avgCost = newStock > 0 ? (totalOldCost + totalNewCost) / newStock : xmlUnit;
                  update.cost = Math.round(avgCost * 100) / 100;
                }

                if ((currentPrice === 0 || !currentPrice) && xmlUnit > 0) {
                  update.price = Math.round(xmlUnit * 1.5 * 100) / 100;
                }

                const { error: updateError } = await supabase
                  .from("products")
                  .update(update as any)
                  .eq("id", productId)
                  .eq("company_id", companyId as string);

                if (!updateError) {
                  await supabase.from("invoice_items").update({ stock_updated: true }).eq("id", insertedItem.id);
                }
              }
            }

            if (productId && match.xmlProduct.code) {
              await supabase.from("product_supplier_skus").upsert({
                product_id: productId,
                supplier_name: nf.nfeData.issuerName,
                supplier_sku: match.xmlProduct.code,
                supplier_cnpj: nf.nfeData.issuerCnpj
              }, { onConflict: 'product_id,supplier_sku' });
            }

            totalProducts++;
          } catch (err) {
            itemsFailedTotal++;
          }
        }
        confirmedCount++;
        totalVal += nf.nfeData.totalValue;
      }

      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });

      setBatchConfirmResult({ confirmed: confirmedCount, products: totalProducts, total: totalVal });
      setDone(true);
      clearPersistedState();
      
      if (itemsFailedTotal > 0) {
        toast({ 
          title: `${confirmedCount} nota(s) confirmada(s)`, 
          description: `${totalProducts} itens salvos. ${itemsFailedTotal} itens com falha ou sem produto — verifique o estoque.`,
        });
      } else {
        toast({ title: `${confirmedCount} nota(s) confirmada(s)!`, description: `${totalProducts} itens vinculados com sucesso.` });
      }
    } catch (err: any) {
      toast({ title: "Erro ao confirmar lote", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return { autoCreateProductFromXml, confirmarEntrada };
};
