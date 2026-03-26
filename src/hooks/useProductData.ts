import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
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
  categories?: { name: string } | null;
  product_suppliers?: { supplier_id: string; cost: number; is_primary: boolean; suppliers: { id: string; name: string } }[];
};

export type ProductFormData = {
  sku: string;
  barcode?: string;
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
};

export function useProducts(filters?: {
  search?: string;
  category_id?: string;
  supplier_id?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*, categories(name), product_suppliers(supplier_id, cost, is_primary, suppliers(id, name))", { count: "exact" });

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%`);
      }
      if (filters?.category_id) {
        query = query.eq("category_id", filters.category_id);
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

      // Filter by supplier_id client-side if needed
      let filtered = data as unknown as Product[];
      if (filters?.supplier_id) {
        filtered = filtered.filter((p) =>
          p.product_suppliers?.some((ps) => ps.supplier_id === filters.supplier_id)
        );
      }

      return { products: filtered, total: count || 0 };
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ProductFormData) => {
      const { supplier_ids, ...productData } = data;
      const insertData = {
        ...productData,
        barcode: productData.barcode || null,
        description: productData.description || null,
        category_id: productData.category_id || null,
        weight: productData.weight ?? null,
        width: productData.width ?? null,
        height: productData.height ?? null,
        depth: productData.depth ?? null,
        sku_ml: productData.sku_ml || null,
        id_ml: productData.id_ml || null,
        min_stock: productData.min_stock ?? 0,
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
      const { supplier_ids, ...productData } = data;
      const updateData = {
        ...productData,
        barcode: productData.barcode || null,
        description: productData.description || null,
        category_id: productData.category_id || null,
        weight: productData.weight ?? null,
        width: productData.width ?? null,
        height: productData.height ?? null,
        depth: productData.depth ?? null,
        sku_ml: productData.sku_ml || null,
        id_ml: productData.id_ml || null,
        min_stock: productData.min_stock ?? 0,
      };

      const { error } = await supabase.from("products").update(updateData).eq("id", id);
      if (error) throw error;

      // Replace supplier links
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
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; cnpj?: string; email?: string; phone?: string; address?: string }) => {
      const { data: supplier, error } = await supabase.from("suppliers").insert(data).select().single();
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
