import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useProducts, useCreateProduct } from "../useProductData";
import { productsService } from "@/services/products";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, createElement } from "react";

vi.mock("@/services/products", () => ({
  productsService: {
    fetchProducts: vi.fn(),
    createProduct: vi.fn(),
    atualizarEstoque: vi.fn(),
  },
}));

vi.mock("@/hooks/useCompanyId", () => ({
  useCompanyId: () => "company-123",
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => 
  createElement(QueryClientProvider, { client: queryClient }, children);

describe("useProductData hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("should load products", async () => {
    const mockProducts = { products: [{ id: "1", name: "Produto Teste" }], total: 1 };
    (productsService.fetchProducts as any).mockResolvedValue(mockProducts);

    const { result } = renderHook(() => useProducts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.products).toHaveLength(1);
    expect(result.current.data?.products[0].name).toBe("Produto Teste");
  });

  it("should create a product", async () => {
    const newProduct = { name: "Novo Produto", price: 100, supplier_ids: [] };
    (productsService.createProduct as any).mockResolvedValue({ id: "2", ...newProduct });

    const { result } = renderHook(() => useCreateProduct(), { wrapper });
    
    await result.current.mutateAsync(newProduct as any);
    
    expect(productsService.createProduct).toHaveBeenCalledWith(newProduct, "company-123");
  });
});
