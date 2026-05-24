import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stockService } from '../services/stock';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

type ProductRecord = {
  stock_physical: number;
};

function createProductsTable(product: ProductRecord) {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: product, error: null }),
  };

  const updateChain = {
    eq: vi.fn(),
  };

  updateChain.eq
    .mockImplementationOnce(() => updateChain)
    .mockResolvedValueOnce({ error: null });

  return {
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue(updateChain),
  };
}

function createLogTable() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe('stockService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('darBaixa', () => {
    it('should decrease stock and log movement', async () => {
      const productsTable = createProductsTable({ stock_physical: 10 });
      const logTable = createLogTable();

      vi.mocked(supabase.from).mockImplementation((table) => {
        if (table === 'products') return productsTable as never;
        if (table === 'stock_movement_logs') return logTable as never;
        throw new Error(`Unexpected table: ${table}`);
      });

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      } as never);

      await stockService.darBaixa('prod-1', 2, 'comp-1');

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(productsTable.update).toHaveBeenCalledWith({ stock_physical: 8 });
      expect(supabase.from).toHaveBeenCalledWith('stock_movement_logs');
      expect(logTable.insert).toHaveBeenCalledWith(expect.objectContaining({
        product_id: 'prod-1',
        company_id: 'comp-1',
        type: 'saida',
        quantity: 2,
        old_stock: 10,
        new_stock: 8,
        stock_type: 'physical',
      }));
    });

    it('should throw error if stock is insufficient', async () => {
      const productsTable = createProductsTable({ stock_physical: 1 });

      vi.mocked(supabase.from).mockImplementation((table) => {
        if (table === 'products') return productsTable as never;
        throw new Error(`Unexpected table: ${table}`);
      });

      await expect(stockService.darBaixa('prod-1', 2, 'comp-1')).rejects.toThrow('Estoque insuficiente');
    });
  });
});
