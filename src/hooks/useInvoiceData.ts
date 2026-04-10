import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { MatchResult } from "@/lib/nfe-parser";
import { enrichProduct } from "@/lib/enrich-product";
import { useCompanyId } from "@/hooks/useCompanyId";

export function useInvoices() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["invoices", companyId],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, invoice_items(*, products(id, name, sku))")
        .order("created_at", { ascending: false });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useInvoiceStats() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["invoice-stats", companyId],
    queryFn: async () => {
      let query = supabase.from("invoices").select("status");
      if (companyId) {
        query = query.eq("company_id", companyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return {
        total: data.length,
        importada: data.filter((i) => i.status === "importada").length,
        aguardando: data.filter((i) => i.status === "aguardando_conferencia").length,
        conferida: data.filter((i) => i.status === "conferida").length,
        divergente: data.filter((i) => i.status === "divergente").length,
      };
    },
  });
}

export function useImportInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: async ({
      nfeData,
      matches,
      createNewProducts,
    }: {
      nfeData: { number: string; series: string; issuerName: string; issuerCnpj: string; totalValue: number };
      matches: MatchResult[];
      createNewProducts: boolean;
    }) => {
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
        })
        .select()
        .single();
      if (invError) throw invError;

      for (const match of matches) {
        let productId = match.matchedProductId;

        if (!productId && createNewProducts) {
          const xmlP = match.xmlProduct;
          const sku = xmlP.code || `XML-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const cost = xmlP.unitValue;
          const markup = 1.5;

          let enrichedData: Partial<{
            description: string;
            weight_kg: number | null;
            width_cm: number | null;
            height_cm: number | null;
            depth_cm: number | null;
            suggested_price_brl: number | null;
          }> = {};

          try {
            enrichedData = await enrichProduct({
              productName: xmlP.description,
              ean: xmlP.ean || undefined,
              ncm: xmlP.ncm || undefined,
              unit: xmlP.unit || undefined,
            });
          } catch {
            // AI enrichment failed
          }

          const description = enrichedData.description
            || `Importado via NF-e ${nfeData.number} | NCM: ${xmlP.ncm || "—"} | Unidade: ${xmlP.unit || "UN"}`;
          const price = enrichedData.suggested_price_brl
            ? enrichedData.suggested_price_brl
            : Math.round(cost * markup * 100) / 100;

          const { data: newProduct, error: prodError } = await supabase
            .from("products")
            .insert({
              sku,
              barcode: xmlP.ean || null,
              name: xmlP.description,
              description,
              cost,
              price,
              stock_physical: 0,
              min_stock: 1,
              active: true,
              weight: enrichedData.weight_kg ?? null,
              width: enrichedData.width_cm ?? null,
              height: enrichedData.height_cm ?? null,
              depth: enrichedData.depth_cm ?? null,
              company_id: companyId,
            })
            .select()
            .single();
          if (prodError) throw prodError;
          productId = newProduct.id;
        }

        await supabase.from("invoice_items").insert({
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
          match_type: productId ? match.matchType : "none",
          match_confidence: match.confidence,
          stock_updated: !!productId,
        });

        if (productId) {
          const { data: current } = await supabase
            .from("products")
            .select("stock_physical, cost, barcode, name, description, price, min_stock")
            .eq("id", productId)
            .single();

          if (current) {
            const xmlP = match.xmlProduct;
            const newStock = current.stock_physical + Math.floor(xmlP.quantity);
            const totalOldCost = current.stock_physical * current.cost;
            const totalNewCost = xmlP.quantity * xmlP.unitValue;
            const avgCost = newStock > 0 ? (totalOldCost + totalNewCost) / newStock : xmlP.unitValue;

            const updates: Record<string, any> = {
              stock_physical: newStock,
              cost: Math.round(avgCost * 100) / 100,
            };

            if (!current.barcode && xmlP.ean) {
              updates.barcode = xmlP.ean;
            }
            if (!current.description || current.description.length < 5) {
              updates.description = `NCM: ${xmlP.ncm || "—"} | Unidade: ${xmlP.unit || "UN"}`;
            }
            if (current.price === 0 && xmlP.unitValue > 0) {
              updates.price = Math.round(xmlP.unitValue * 1.5 * 100) / 100;
            }
            if (current.min_stock === 0) {
              updates.min_stock = 1;
            }

            await supabase
              .from("products")
              .update(updates as any)
              .eq("id", productId);
          }
        }
      }

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Nota fiscal importada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao importar nota", description: error.message, variant: "destructive" });
    },
  });
}
