import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  ean: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  cost: number;
  price: number;
  weight: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  sku_ml: string | null;
  id_ml: string | null;
  stock_physical: number;
  stock_full: number;
  min_stock: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  company_id: string | null;
  image_url: string | null;
  gtin_cx: string | null;
  box_quantity: number | null;
  categories?: { name: string } | null;
  product_suppliers?: { supplier_id: string; cost: number; is_primary: boolean; suppliers: { id: string; name: string } }[];
  product_alternative_gtins?: { gtin: string }[];
  product_supplier_skus?: { id: string; supplier_name: string; supplier_sku: string }[];
};

export type ProductFormData = {
  sku: string;
  barcode?: string;
  ean?: string;
  name: string;
  description?: string;
  category_id?: string;
  cost: number;
  price: number;
  weight?: number;
  width?: number;
  height?: number;
  depth?: number;
  sku_ml?: string;
  id_ml?: string;
  min_stock?: number;
  supplier_ids: string[];
  image_url?: string;
  gtin_cx?: string;
  box_quantity?: number;
  supplier_skus?: { supplier_name: string; supplier_sku: string }[];
};

export function useProducts(filters?: {
  search?: string;
  category_id?: string;
  supplier_id?: string;
  status?: "active" | "inactive" | "all";
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  needsCorrection?: "no_sku" | "no_supplier" | "no_ean";
}) {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["products", filters, companyId],
    queryFn: async () => {
      let query;
      
      if (filters?.search && companyId) {
        // Use the RPC for searching across products and supplier SKUs
        query = supabase
          .rpc("search_products_with_suppliers", {
            search_term: filters.search,
            p_company_id: companyId
          })
          .select("*, categories(name), product_suppliers(supplier_id, cost, is_primary, suppliers(id, name)), product_alternative_gtins(gtin), product_supplier_skus(*)");
        
        if (filters?.needsCorrection === "no_sku") {
          query = query.or("sku.is.null,sku.eq.''");
        } else if (filters?.needsCorrection === "no_ean") {
          query = query.eq("ean_pending", true);
        }

      } else {
        query = supabase
          .from("products")
          .select("*, categories(name), product_suppliers(supplier_id, cost, is_primary, suppliers(id, name)), product_alternative_gtins(gtin), product_supplier_skus(*)", { count: "exact" });

        if (companyId) {
          query = query.eq("company_id", companyId);
        }
      }
      
      const statusFilter = filters?.status || "active";
      if (statusFilter === "active") {
        query = query.eq("active", true);
      } else if (statusFilter === "inactive") {
        query = query.eq("active", false);
      }

      if (filters?.category_id) {
        query = query.eq("category_id", filters.category_id);
      }

      if (filters?.needsCorrection === "no_sku") {
        query = query.or("sku.is.null,sku.eq.''");
      } else if (filters?.needsCorrection === "no_ean") {
        query = query.eq("ean_pending", true);
      }

      const sortBy = filters?.sortBy || "created_at";
      const sortOrder = filters?.sortOrder === "asc" ? true : false;
      query = query.order(sortBy, { ascending: sortOrder });

      const page = filters?.page || 1;
      const pageSize = filters?.pageSize || 10;
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      let filtered = data as unknown as Product[];
      if (filters?.supplier_id) {
        filtered = filtered.filter((p) =>
          p.product_suppliers?.some((ps) => ps.supplier_id === filters.supplier_id)
        );
      }
      if (filters?.needsCorrection === "no_supplier") {
        filtered = filtered.filter((p) => !p.product_supplier_skus || p.product_supplier_skus.length === 0);
      }

      return { products: filtered, total: count || 0 };
    },
  });
}

/**
 * Carrega TODOS os produtos da empresa, paginando em lotes de 1000
 * para contornar o limite padrão do Supabase. Use em telas como
 * Conferência e Balanço de Estoque, onde é necessário a base completa.
 */
export function useAllProducts(opts?: { activeOnly?: boolean }) {
  const companyId = useCompanyId();
  const activeOnly = opts?.activeOnly ?? true;

  return useQuery({
    queryKey: ["products-all", companyId, activeOnly],
    enabled: !!companyId,
    queryFn: async () => {
      const PAGE = 1000;
      let all: Product[] = [];
      let page = 0;
      // Loop seguro até esvaziar
      while (true) {
        let q = supabase
          .from("products")
          .select("*, categories(name), product_suppliers(supplier_id, cost, is_primary, suppliers(id, name)), product_alternative_gtins(gtin), product_supplier_skus(*)")
          .eq("company_id", companyId!)
          .order("name", { ascending: true })
          .range(page * PAGE, (page + 1) * PAGE - 1);
        if (activeOnly) q = q.eq("active", true);

        const { data, error } = await q;
        if (error) throw error;
        const batch = (data ?? []) as unknown as Product[];
        all = all.concat(batch);
        if (batch.length < PAGE) break;
        page++;
        // Salvaguarda contra loops anômalos (>200k produtos)
        if (page > 200) break;
      }
      return { products: all, total: all.length };
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: async (data: ProductFormData) => {
      const { supplier_ids, supplier_skus, ...productData } = data;
      const insertData = {
        ...productData,
        barcode: productData.barcode || null,
        ean: productData.ean || productData.barcode || null,
        description: productData.description || null,
        category_id: productData.category_id || null,
        weight: productData.weight ?? null,
        width: productData.width ?? null,
        height: productData.height ?? null,
        depth: productData.depth ?? null,
        sku_ml: productData.sku_ml || null,
        id_ml: productData.id_ml || null,
        min_stock: productData.min_stock ?? 0,
        company_id: companyId,
        image_url: productData.image_url || null,
        gtin_cx: productData.gtin_cx || null,
        box_quantity: productData.box_quantity ?? null,
      };

      const { data: product, error } = await supabase
        .from("products")
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;

      if (supplier_ids.length > 0) {
        const supplierLinks = supplier_ids.map((sid, i) => ({
          product_id: product.id,
          supplier_id: sid,
          cost: data.cost,
          is_primary: i === 0,
        }));
        const { error: linkError } = await supabase.from("product_suppliers").insert(supplierLinks);
        if (linkError) throw linkError;
      }
      
      if (supplier_skus && supplier_skus.length > 0) {
        const skusToInsert = supplier_skus.map(s => ({
          product_id: product.id,
          supplier_name: s.supplier_name,
          supplier_sku: s.supplier_sku
        }));
        const { error: skuError } = await supabase.from("product_supplier_skus").insert(skusToInsert);
        if (skuError) throw skuError;
      }

      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar produto", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductFormData }) => {
      const { supplier_ids, supplier_skus, ...productData } = data;
      const updateData = {
        ...productData,
        barcode: productData.barcode || null,
        ean: productData.ean || productData.barcode || null,
        description: productData.description || null,
        category_id: productData.category_id || null,
        weight: productData.weight ?? null,
        width: productData.width ?? null,
        height: productData.height ?? null,
        depth: productData.depth ?? null,
        sku_ml: productData.sku_ml || null,
        id_ml: productData.id_ml || null,
        min_stock: productData.min_stock ?? 0,
        image_url: productData.image_url || null,
        gtin_cx: productData.gtin_cx || null,
        box_quantity: productData.box_quantity ?? null,
      };

      const { error } = await supabase.from("products").update(updateData).eq("id", id);
      if (error) throw error;

      await supabase.from("product_suppliers").delete().eq("product_id", id);
      if (supplier_ids.length > 0) {
        const supplierLinks = supplier_ids.map((sid, i) => ({
          product_id: id,
          supplier_id: sid,
          cost: data.cost,
          is_primary: i === 0,
        }));
        await supabase.from("product_suppliers").insert(supplierLinks);
      }

      await supabase.from("product_supplier_skus").delete().eq("product_id", id);
      if (supplier_skus && supplier_skus.length > 0) {
        const skusToInsert = supplier_skus.map(s => ({
          product_id: id,
          supplier_name: s.supplier_name,
          supplier_sku: s.supplier_sku
        }));
        await supabase.from("product_supplier_skus").insert(skusToInsert);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Tabelas para verificar histórico
      const tablesToCheck = [
        "sale_items",
        "full_order_items",
        "invoice_items",
        "ml_order_items",
        "transfer_items",
        "conference_items",
        "store_orders" // Verificando pedidos vinculados também
      ];
      
      let hasHistory = false;

      // Executa as verificações em paralelo para performance
      const checks = await Promise.all(
        tablesToCheck.map(async (table) => {
          try {
            const { count, error } = await (supabase.from(table as any) as any)
              .select("*", { count: "exact", head: true })
              .eq("product_id", id);
            
            if (error) {
              // Se a tabela não existir ou outro erro, apenas ignora
              console.warn(`Erro ao verificar histórico na tabela ${table}:`, error);
              return 0;
            }
            return count || 0;
          } catch (e) {
            return 0;
          }
        })
      );

      hasHistory = checks.some(count => count > 0);

      if (hasHistory) {
        // Desativa em vez de excluir
        const { error } = await supabase
          .from("products")
          .update({ active: false })
          .eq("id", id);
        
        if (error) throw error;
        return { deactivated: true };
      } else {
        // Tenta excluir (se houver outras FKs não mapeadas, o erro do banco será pego pelo onError)
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) throw error;
        return { deactivated: false };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (result.deactivated) {
        toast({ 
          title: "Produto desativado", 
          description: "Este produto não pode ser excluído pois possui histórico de vendas ou movimentações. Para preservá-lo no histórico, ele foi desativado.",
        });
      } else {
        toast({ title: "Produto excluído!" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir/desativar", description: error.message, variant: "destructive" });
    },
  });
}

export function useCategories() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["categories", companyId],
    queryFn: async () => {
      let query = supabase.from("categories").select("*").order("name");
      if (companyId) {
        query = query.eq("company_id", companyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useSuppliers() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["suppliers", companyId],
    queryFn: async () => {
      let query = supabase.from("suppliers").select("*").eq("active", true).order("name");
      if (companyId) {
        query = query.eq("company_id", companyId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: async (data: { name: string; cnpj?: string; email?: string; phone?: string; address?: string }) => {
      const { data: supplier, error } = await supabase.from("suppliers").insert({ ...data, company_id: companyId }).select().single();
      if (error) throw error;
      return supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Fornecedor criado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar fornecedor", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Fornecedor excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });
}
