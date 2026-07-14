import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoicesService } from "@/services/invoices";
import { supabase } from "@/integrations/supabase/client";
import { stockService } from "@/services/stock";
import type { MatchResult } from "@/lib/nfe-parser";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/services/stock", () => ({
  stockService: {
    logMovement: vi.fn(),
  },
}));

vi.mock("@/lib/enrich-product", () => ({
  enrichProduct: vi.fn().mockResolvedValue({}),
}));

type TableMocks = Record<string, any>;

function chain(data: any, error: any = null) {
  return {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then(resolve: any, reject: any) {
      return Promise.resolve({ data, error }).then(resolve, reject);
    },
  };
}

function createMatchedProductInvoiceTables() {
  const invoice = { id: "invoice-1", status: "aguardando_conferencia" };
  const updatedInvoice = { ...invoice, status: "importada" };
  const item = { id: "item-1" };

  const invoicesDuplicateCheck = chain(null); // No duplicate found
  const invoicesInsertChain = chain(invoice);
  const invoicesStatusChain = chain(updatedInvoice);
  const invoices = {
    select: vi.fn(() => invoicesDuplicateCheck),
    insert: vi.fn(() => invoicesInsertChain),
    update: vi.fn(() => invoicesStatusChain),
  };

  const invoiceItemsInsertChain = chain(item);
  const invoiceItemsUpdateChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
  const invoiceItems = {
    insert: vi.fn(() => invoiceItemsInsertChain),
    update: vi.fn(() => invoiceItemsUpdateChain),
  };

  const productSelectChain = chain({
    stock_physical: 4,
    cost: 10,
    barcode: "789",
    ean: "789",
    name: "Produto existente",
    description: null,
    price: 20,
    min_stock: 1,
    ean_pending: false,
  });
  const productsUpdateChain = { eq: vi.fn().mockReturnThis() };
  productsUpdateChain.eq.mockReturnValueOnce(productsUpdateChain).mockResolvedValueOnce({ error: null });
  const products = {
    select: vi.fn(() => productSelectChain),
    update: vi.fn(() => productsUpdateChain),
  };

  return { invoices, invoiceItems, products, invoice, updatedInvoice, item, invoiceItemsUpdateChain };
}

function createNewProductInvoiceTables() {
  const invoice = { id: "invoice-new", status: "aguardando_conferencia" };
  const updatedInvoice = { ...invoice, status: "importada" };
  const newProduct = { id: "product-new" };
  const item = { id: "item-new" };

  const invoicesDuplicateCheck = chain(null); // No duplicate found
  const invoicesInsertChain = chain(invoice);
  const invoicesStatusChain = chain(updatedInvoice);
  const invoices = {
    select: vi.fn(() => invoicesDuplicateCheck),
    insert: vi.fn(() => invoicesInsertChain),
    update: vi.fn(() => invoicesStatusChain),
  };

  const invoiceItemsInsertChain = chain(item);
  const invoiceItemsUpdateChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
  const invoiceItems = {
    insert: vi.fn(() => invoiceItemsInsertChain),
    update: vi.fn(() => invoiceItemsUpdateChain),
  };

  const productsInsertChain = chain(newProduct);
  const products = {
    insert: vi.fn(() => productsInsertChain),
  };

  return { invoices, invoiceItems, products, updatedInvoice, item, newProduct };
}

function matchedProduct(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    xmlProduct: {
      code: "SKU-1",
      ean: "789",
      description: "Produto NF-e",
      ncm: "12345678",
      cfop: "5102",
      unit: "UN",
      quantity: 3,
      unitValue: 16,
      totalValue: 48,
    },
    matchedProductId: "product-1",
    matchedProductName: "Produto existente",
    matchedProductBarcode: "789",
    matchedProductEan: "789",
    matchedProductSku: "SKU-1",
    matchedProductGtinCx: null,
    matchedProductBoxQty: null,
    matchType: "exact",
    confidence: 1,
    ...overrides,
  };
}

const nfeData = {
  number: "123",
  series: "1",
  issuerName: "Fornecedor Teste",
  issuerCnpj: "12345678000190",
  totalValue: 48,
};

describe("invoicesService", () => {
  const companyId = "company-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("importInvoice", () => {
    it("updates existing product stock and returns a processed import summary", async () => {
      const tables = createMatchedProductInvoiceTables();
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "invoices") return tables.invoices as never;
        if (table === "invoice_items") return tables.invoiceItems as never;
        if (table === "products") return tables.products as never;
        throw new Error(`Unexpected table: ${table}`);
      });

      const result = await invoicesService.importInvoice({
        nfeData,
        matches: [matchedProduct()],
        createNewProducts: false,
        companyId,
      });

      expect(tables.invoiceItems.insert).toHaveBeenCalledWith(expect.objectContaining({
        invoice_id: tables.invoice.id,
        product_id: "product-1",
        match_type: "exact",
        stock_updated: false,
      }));
      expect(tables.products.update).toHaveBeenCalledWith(expect.objectContaining({
        stock_physical: 7,
        cost: 12.57,
      }));
      expect(tables.invoiceItems.update).toHaveBeenCalledWith(expect.objectContaining({
        product_id: "product-1",
        stock_updated: true,
      }));
      expect(stockService.logMovement).toHaveBeenCalledWith(expect.objectContaining({
        productId: "product-1",
        companyId,
        type: "entrada",
        quantity: 3,
        oldStock: 4,
        newStock: 7,
        referenceId: tables.invoice.id,
        referenceType: "invoice",
      }));
      expect(tables.invoices.update).toHaveBeenCalledWith({ status: "importada" });
      expect(result).toEqual({
        invoice: tables.updatedInvoice,
        createdCount: 0,
        updatedCount: 1,
        pendingCount: 0,
        skippedCount: 0,
      });
    });

    it("creates new products with initial stock and logs the created item as processed", async () => {
      const tables = createNewProductInvoiceTables();
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "invoices") return tables.invoices as never;
        if (table === "invoice_items") return tables.invoiceItems as never;
        if (table === "products") return tables.products as never;
        throw new Error(`Unexpected table: ${table}`);
      });

      const result = await invoicesService.importInvoice({
        nfeData,
        matches: [matchedProduct({ matchedProductId: null, matchType: "none" })],
        createNewProducts: true,
        companyId,
      });

      expect(tables.products.insert).toHaveBeenCalledWith(expect.objectContaining({
        name: "Produto NF-e",
        stock_physical: 3,
        cost: 16,
        company_id: companyId,
      }));
      expect(tables.invoiceItems.insert).toHaveBeenCalledWith(expect.objectContaining({
        product_id: tables.newProduct.id,
        match_type: "new",
        stock_updated: true,
      }));
      expect(tables.invoiceItems.update).toHaveBeenCalledWith(expect.objectContaining({
        product_id: tables.newProduct.id,
        stock_updated: true,
        match_type: "new",
      }));
      expect(stockService.logMovement).toHaveBeenCalledWith(expect.objectContaining({
        productId: tables.newProduct.id,
        quantity: 3,
        oldStock: 0,
        newStock: 3,
      }));
      expect(result).toEqual({
        invoice: tables.updatedInvoice,
        createdCount: 1,
        updatedCount: 0,
        pendingCount: 0,
        skippedCount: 0,
      });
    });

    it("keeps unmatched items pending when product creation is disabled", async () => {
      const invoice = { id: "invoice-pending", status: "aguardando_conferencia" };
      const updatedInvoice = { ...invoice, status: "aguardando_conferencia" };
      const invoices = {
        select: vi.fn(() => chain(null)), // No duplicate found
        insert: vi.fn(() => chain(invoice)),
        update: vi.fn(() => chain(updatedInvoice)),
      };
      const invoiceItems = {
        insert: vi.fn(() => chain({ id: "item-pending" })),
      };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "invoices") return invoices as never;
        if (table === "invoice_items") return invoiceItems as never;
        throw new Error(`Unexpected table: ${table}`);
      });

      const result = await invoicesService.importInvoice({
        nfeData,
        matches: [matchedProduct({ matchedProductId: null, matchType: "none" })],
        createNewProducts: false,
        companyId,
      });

      expect(invoiceItems.insert).toHaveBeenCalledWith(expect.objectContaining({
        product_id: null,
        match_type: "none",
        stock_updated: false,
      }));
      expect(stockService.logMovement).not.toHaveBeenCalled();
      expect(invoices.update).toHaveBeenCalledWith({ status: "aguardando_conferencia" });
      expect(result).toEqual({
        invoice: updatedInvoice,
        createdCount: 0,
        updatedCount: 0,
        pendingCount: 1,
        skippedCount: 0,
      });
    });
  });
});
