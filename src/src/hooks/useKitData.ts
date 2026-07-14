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
  // Campos de estoque do kit
  stock_physical?: number;
  stock_full?: number;
  stock_reserved?: number;
  cost?: number;
  stock_min?: number;
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
  active?: boolean;
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
        .order("created_at", { ascending: false })
        .eq("company_id", companyId as string);

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

export function useBulkCreateKits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: async (kits: KitFormData[]) => {
      const results = [];
      for (const data of kits) {
        const { items, ...kitData } = data;
        const { data: kit, error } = await supabase
          .from("product_kits")
          .insert({ ...kitData, description: kitData.description || null, company_id: companyId })
          .select()
          .maybeSingle();
        if (error) throw error;
        if (items.length > 0 && kit) {
          const kitItems = items.map((item) => ({
            kit_id: kit.id,
            product_id: item.product_id,
            quantity: item.quantity,
          }));
          const { error: itemsError } = await supabase.from("kit_items").insert(kitItems);
          if (itemsError) throw itemsError;
        }
        results.push(kit);
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["kits"] });
      toast({ title: `${results.length} kits criados com sucesso!` });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na criação em massa", description: error.message, variant: "destructive" });
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

export function useAllKits() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["kits-all", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_kits")
        .select("*, kit_items(*, products(id, name, sku, ean, barcode, stock_physical, stock_full, cost, price))")
        .eq("company_id", companyId as string)
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as unknown as Kit[];
    },
  });
}

/**
 * Monta um kit: transfere estoque dos itens avulsos para o kit
 * - Remove estoque dos produtos individuais
 * - Adiciona +1 ao estoque do kit
 */
export function useMontarKit() {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ kitId, quantidade = 1 }: { kitId: string; quantidade?: number }) => {
      // 1. Buscar kit e seus itens
      const { data: kit, error: kitError } = await supabase
        .from("product_kits")
        .select("*, kit_items(*, products(id, name, stock_physical))")
        .eq("id", kitId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (kitError || !kit) throw new Error("Kit não encontrado");
      if (!kit.kit_items || kit.kit_items.length === 0) {
        throw new Error("Kit sem itens cadastrados");
      }

      // 2. Verificar se há estoque suficiente de cada item
      const erros: string[] = [];
      for (const item of kit.kit_items) {
        const product = (item as any).products;
        const needed = item.quantity * quantidade;
        if (!product || product.stock_physical < needed) {
          erros.push(`${product?.name || 'Item'}: precisa de ${needed}, tem ${product?.stock_physical || 0}`);
        }
      }

      if (erros.length > 0) {
        throw new Error(`Estoque insuficiente:\n${erros.join('\n')}`);
      }

      // 3. Baixar estoque dos produtos avulsos
      for (const item of kit.kit_items) {
        const product = (item as any).products;
        const needed = item.quantity * quantidade;

        await supabase
          .from("products")
          .update({ stock_physical: product.stock_physical - needed })
          .eq("id", item.product_id);
      }

      // 4. Adicionar ao estoque do kit
      const novoStock = (kit.stock_physical || 0) + quantidade;
      await supabase
        .from("product_kits")
        .update({ stock_physical: novoStock })
        .eq("id", kitId)
        .eq("company_id", companyId);

      return { kit, quantidade, novoStock };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["kits"] });
      queryClient.invalidateQueries({ queryKey: ["kits-all"] });
      toast({
        title: "Kit montado!",
        description: `${result.quantidade}x "${result.kit.name}" adicionado ao estoque.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao montar kit", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Desmonta um kit: transfere estoque do kit de volta para os itens avulsos
 */
export function useDesmontarKit() {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ kitId, quantidade = 1 }: { kitId: string; quantidade?: number }) => {
      // 1. Buscar kit e seus itens
      const { data: kit, error: kitError } = await supabase
        .from("product_kits")
        .select("*, kit_items(*, products(id, name, stock_physical))")
        .eq("id", kitId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (kitError || !kit) throw new Error("Kit não encontrado");
      if (!kit.kit_items || kit.kit_items.length === 0) {
        throw new Error("Kit sem itens cadastrados");
      }

      // 2. Verificar se há estoque do kit suficiente
      if ((kit.stock_physical || 0) < quantidade) {
        throw new Error(`Estoque do kit insuficiente. Disponível: ${kit.stock_physical || 0}`);
      }

      // 3. Devolver estoque aos produtos avulsos
      for (const item of kit.kit_items) {
        const product = (item as any).products;
        const returned = item.quantity * quantidade;

        await supabase
          .from("products")
          .update({ stock_physical: (product.stock_physical || 0) + returned })
          .eq("id", item.product_id);
      }

      // 4. Baixar do estoque do kit
      const novoStock = (kit.stock_physical || 0) - quantidade;
      await supabase
        .from("product_kits")
        .update({ stock_physical: novoStock })
        .eq("id", kitId)
        .eq("company_id", companyId);

      return { kit, quantidade, novoStock };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["kits"] });
      queryClient.invalidateQueries({ queryKey: ["kits-all"] });
      toast({
        title: "Kit desmontado!",
        description: `${result.quantidade}x "${result.kit.name}" removido do estoque.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao desmontar kit", description: error.message, variant: "destructive" });
    },
  });
}
