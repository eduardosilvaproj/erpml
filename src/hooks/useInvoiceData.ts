import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { MatchResult } from "@/lib/nfe-parser";

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, invoice_items(*, products(id, name, sku))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useInvoiceStats() {
  return useQuery({
    queryKey: ["invoice-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("status");
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
      // 1. Create invoice record
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
        })
        .select()
        .single();
      if (invError) throw invError;

      // 2. Process each item
      for (const match of matches) {
        let productId = match.matchedProductId;

        // Create new product if no match and flag is set
        if (!productId && createNewProducts) {
          const { data: newProduct, error: prodError } = await supabase
            .from("products")
            .insert({
              sku: match.xmlProduct.code || `XML-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              barcode: match.xmlProduct.ean || null,
              name: match.xmlProduct.description,
              cost: match.xmlProduct.unitValue,
              price: match.xmlProduct.unitValue * 1.5, // default markup
              stock_physical: 0,
            })
            .select()
            .single();
          if (prodError) throw prodError;
          productId = newProduct.id;
        }

        // Insert invoice item
        await supabase.from("invoice_items").insert({
          invoice_id: invoice.id,
          product_id: productId,
          xml_code: match.xmlProduct.code,
          xml_description: match.xmlProduct.description,
          quantity: match.xmlProduct.quantity,
          unit_value: match.xmlProduct.unitValue,
          total_value: match.xmlProduct.totalValue,
          match_type: productId ? match.matchType : "none",
          match_confidence: match.confidence,
          stock_updated: !!productId,
        });

        // Update stock if matched
        if (productId) {
          const { data: current } = await supabase
            .from("products")
            .select("stock_physical, cost")
            .eq("id", productId)
            .single();

          if (current) {
            const newStock = current.stock_physical + Math.floor(match.xmlProduct.quantity);
            // Calculate weighted average cost
            const totalOldCost = current.stock_physical * current.cost;
            const totalNewCost = match.xmlProduct.quantity * match.xmlProduct.unitValue;
            const avgCost = newStock > 0 ? (totalOldCost + totalNewCost) / newStock : match.xmlProduct.unitValue;

            await supabase
              .from("products")
              .update({
                stock_physical: newStock,
                cost: Math.round(avgCost * 100) / 100,
              })
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
