import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface Kit {
  id: string;
  name: string;
  sku: string;
  ean?: string;
  description: string | null;
  price: number;
  active: boolean;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  kit_items?: KitItem[];
}

export interface KitItem {
  id: string;
  kit_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  products?: { id: string; name: string; sku: string; ean: string | null; barcode: string | null; stock_physical: number; stock_full: number; cost: number; price: number };
}

export interface KitFormData {
  name: string;
  sku: string;
  ean?: string;
  description?: string;
  price: number;
  items: { product_id: string; quantity: number }[];
}

export function useKits() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["kits", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from("product_kits")
        .select("*, kit_items(*, products(id, name, sku, ean, barcode, stock_physical, stock_full, cost, price))")
        .order("created_at", { ascending: false });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Kit[];
    },
  });
}

export function useCreateKit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: async (data: KitFormData) => {
      const { items, ...kitData } = data;

      const { data: kit, error } = await supabase
        .from("product_kits")
        .insert({
          ...kitData,
          description: kitData.description || null,
          company_id: companyId,
        })
        .select()
        .maybeSingle();
      if (error) throw error;

      if (items.length > 0) {
        const kitItems = items.map((item) => ({
          kit_id: kit.id,
          product_id: item.product_id,
          quantity: item.quantity,
        }));
        const { error: itemsError } = await supabase.from("kit_items").insert(kitItems);
        if (itemsError) throw itemsError;
      }

      return kit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kits"] });
      toast({ title: "Kit criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar kit", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateKit() {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: KitFormData }) => {
      const { items, ...kitData } = data;

      const { error } = await supabase
        .from("product_kits")
        .update({ ...kitData, description: kitData.description || null })
        .eq("id", id)
        .eq("company_id", companyId);
      if (error) throw error;

      // Delete existing items and re-insert
      const { error: delErr } = await supabase.from("kit_items").delete().eq("kit_id", id);
      if (delErr) throw delErr;

      if (items.length > 0) {
        const kitItems = items.map((item) => ({
          kit_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
        }));
        const { error: insErr } = await supabase.from("kit_items").insert(kitItems);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kits"] });
      toast({ title: "Kit atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar kit", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteKit() {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_kits").delete().eq("id", id).eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kits"] });
      toast({ title: "Kit excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir kit", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Deducts stock for all items in a kit (used during transfers/movements).
 * Returns the list of products affected with quantities.
 */
export function useDeductKitStock() {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ kitId, quantity, type }: { kitId: string; quantity: number; type: "physical_to_full" | "physical" }) => {
      // Get kit items
      const { data: kitItems, error } = await supabase
        .from("kit_items")
        .select("product_id, quantity, products(id, name, ean, barcode, stock_physical, stock_full)")
        .eq("kit_id", kitId);

      if (error) throw error;
      if (!kitItems || kitItems.length === 0) throw new Error("Kit sem itens cadastrados.");

      // Validate stock for all items
      for (const item of kitItems) {
        const product = (item as any).products;
        const needed = item.quantity * quantity;
        if (!product || product.stock_physical < needed) {
          throw new Error(`Estoque insuficiente para "${product?.name}". Necessário: ${needed}, Disponível: ${product?.stock_physical ?? 0}`);
        }
      }

      // Deduct stock
      for (const item of kitItems) {
        const product = (item as any).products;
        const needed = item.quantity * quantity;

        if (type === "physical_to_full") {
          await supabase
            .from("products")
            .update({
              stock_physical: product.stock_physical - needed,
              stock_full: product.stock_full + needed,
            })
            .eq("id", item.product_id)
            .eq("company_id", companyId);
        } else {
          await supabase
            .from("products")
            .update({ stock_physical: product.stock_physical - needed })
            .eq("id", item.product_id)
            .eq("company_id", companyId);
        }
      }

      return kitItems;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["kits"] });
      toast({ title: "Estoque do kit movimentado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na movimentação do kit", description: error.message, variant: "destructive" });
    },
  });
}

export function useBulkCreateKits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: async (kits: KitFormData[]) => {
      const created: string[] = [];
      for (const data of kits) {
        const { items, ...kitData } = data;

        const { data: kit, error } = await supabase
          .from("product_kits")
          .insert({ ...kitData, description: kitData.description || null, company_id: companyId })
          .select()
          .maybeSingle();
        if (error) throw error;

        if (items.length > 0) {
          const kitItems = items.map((item) => ({
            kit_id: kit.id,
            product_id: item.product_id,
            quantity: item.quantity,
          }));
          await supabase.from("kit_items").insert(kitItems);
        }
        created.push(kit.id);
      }
      return created;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ["kits"] });
      toast({ title: `${ids.length} kit(s) criado(s) com sucesso!` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na criação em massa", description: error.message, variant: "destructive" });
    },
  });
}
