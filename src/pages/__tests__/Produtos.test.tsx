import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Produtos from "../Produtos";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import * as useProductData from "@/hooks/useProductData";

vi.mock("@/hooks/useProductData", async () => {
  const actual = await vi.importActual("@/hooks/useProductData");
  return {
    ...actual,
    useProductsInfinite: vi.fn(),
    useCategories: vi.fn(),
    useSuppliers: vi.fn(),
    useDeleteProduct: vi.fn(() => ({ mutate: vi.fn() })),
  };
});

vi.mock("@/hooks/useCompanyId", () => ({
  useCompanyId: () => "company-123",
}));

vi.mock("@/hooks/useBarcodeSearch", () => ({
  useBarcodeSearch: () => ({
    notFoundOpen: false,
    setNotFoundOpen: vi.fn(),
    boxDetectedOpen: false,
    setBoxDetectedOpen: vi.fn(),
    lastCodigo: "",
    lastResult: null,
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderPage = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Produtos />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe("Produtos Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useProductData.useCategories as any).mockReturnValue({ data: [] });
    (useProductData.useSuppliers as any).mockReturnValue({ data: [] });
  });

  it("should render product list correctly", async () => {
    (useProductData.useProductsInfinite as any).mockReturnValue({
      data: {
        pages: [{
          products: [
            { id: "1", sku: "SKU1", name: "Produto 1", price: 10, stock_physical: 5, active: true }
          ]
        }]
      },
      isLoading: false,
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    renderPage();

    expect(screen.getByText("Produto 1")).toBeInTheDocument();
    expect(screen.getByText("SKU1")).toBeInTheDocument();
  });

  it("should handle search filter", async () => {
    const mockFetch = vi.fn();
    (useProductData.useProductsInfinite as any).mockReturnValue({
      data: { pages: [{ products: [] }] },
      isLoading: false,
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    renderPage();

    const searchInput = screen.getByPlaceholderText(/Buscar por nome ou código/i);
    fireEvent.change(searchInput, { target: { value: "test query" } });

    await waitFor(() => {
        expect(useProductData.useProductsInfinite).toHaveBeenCalledWith(expect.objectContaining({
            search: "test query"
        }));
    });
  });
});
