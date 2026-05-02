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
 * Hook para buscar produtos paginados com filtros aplicados.
 * 
 * @param filters - Filtros opcionais (busca, categoria, fornecedor, status, ordenação).
 * @returns {import("@tanstack/react-query").UseQueryResult} Objeto contendo produtos e metadados da consulta.
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
 * Hook para carregar todos os produtos de uma empresa sem paginação.
 * Útil para seletores e listas de referência rápida.
 * 
 * @param opts - Opções como carregar apenas ativos (padrão: true).
 * @returns {import("@tanstack/react-query").UseQueryResult} Lista completa de produtos.
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
 * Hook para busca infinita de produtos (Infinite Scroll).
 * Implementa cursor-based pagination para performance em listas grandes.
 * 
 * @param filters - Filtros de busca e ordenação.
 * @returns {import("@tanstack/react-query").UseInfiniteQueryResult} Dados das páginas carregadas e funções de controle.
 */
export function useProductsInfinite(filters?: {
  search?: string;
  category_id?: string;
  supplier_id?: string;
  status?: "active" | "inactive" | "all";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  needsCorrection?: "no_sku" | "no_supplier" | "no_ean";
}) {
  const companyId = useCompanyId();
  const pageSize = 50;

  return useInfiniteQuery({
    queryKey: ["products-infinite", filters, companyId],
    enabled: !!companyId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const result = await productsService.fetchProducts(
        { ...filters, page: (pageParam / pageSize) + 1, pageSize },
        companyId
      );
      return result;
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.length * pageSize;
      return totalLoaded < lastPage.total ? totalLoaded : undefined;
    },
  });
}

/**
 * Hook para criar um novo produto no sistema.
 * Realiza validação no servidor via Edge Function antes da inserção.
 * 
 * @returns {import("@tanstack/react-query").UseMutationResult} Função de mutação e estado da operação.
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
 * Hook para atualizar os dados de um produto existente.
 * 
 * @returns {import("@tanstack/react-query").UseMutationResult} Função de mutação para atualização.
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
 * Hook para excluir ou desativar um produto.
 * Se o produto possuir histórico (vendas, etc), ele será apenas desativado.
 * 
 * @returns {import("@tanstack/react-query").UseMutationResult} Função para disparar a remoção.
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
