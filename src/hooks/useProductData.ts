import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { productsService } from "@/services/products";
import type { Database } from "@/integrations/supabase/types";

/**
 * Interface representing a Product in the system.
 * Directly mapped from the database schema with additional joined fields.
 */
export type Product = Database["public"]["Tables"]["products"]["Row"] & {
  categories?: { name: string } | null;
  product_suppliers?: { 
    supplier_id: string; 
    cost: number; 
    is_primary: boolean; 
    suppliers: { id: string; name: string } 
  }[];
  product_alternative_gtins?: { gtin: string }[];
  product_supplier_skus?: { 
    id: string; 
    supplier_name: string; 
    supplier_sku: string 
  }[];
};

/**
 * Data required to create or update a product.
 */
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

/**
 * Hook to fetch paginated products with filters.
 * 
 * @example
 * const { data, isLoading } = useProducts({ search: 'fones', status: 'active' });
 */
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
    enabled: !!companyId,
    queryFn: () => productsService.fetchProducts(filters, companyId),
  });
}

/**
 * Hook to fetch all products for a company.
 */
export function useAllProducts(opts?: { activeOnly?: boolean }) {
  const companyId = useCompanyId();
  const activeOnly = opts?.activeOnly ?? true;

  return useQuery({
    queryKey: ["products-all", companyId, activeOnly],
    enabled: !!companyId,
    queryFn: () => productsService.fetchAllProducts(companyId!, activeOnly),
  });
}

/**
 * Hook to create a new product.
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: (data: ProductFormData) => productsService.createProduct(data, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Produto criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar produto", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Hook to update an existing product.
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductFormData }) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return productsService.updateProduct(id, data, companyId);
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

/**
 * Hook to delete or deactivate a product.
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: (id: string) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return productsService.deleteProduct(id, companyId);
    },
    onSuccess: (result: { deactivated: boolean }) => {
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

/**
 * Hook to fetch product categories.
 */
export function useCategories() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["categories", companyId],
    enabled: !!companyId,
    queryFn: () => productsService.fetchCategories(companyId),
  });
}

/**
 * Hook to fetch suppliers for the company.
 */
export function useSuppliers() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["suppliers", companyId],
    enabled: !!companyId,
    queryFn: () => productsService.fetchSuppliers(companyId),
  });
}

/**
 * Hook to create a new supplier.
 */
export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: (data: { name: string; cnpj?: string; email?: string; phone?: string; address?: string }) => 
      productsService.createSupplier(data, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "Fornecedor criado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar fornecedor", description: error.message, variant: "destructive" });
    },
  });
}

/**
 * Hook to delete a supplier.
 */
export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: (id: string) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      return productsService.deleteSupplier(id, companyId);
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
