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

function createProductsTable(product: ProductRecord | null) {
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
    selectChain,
    updateChain,
  };
}

function createLogTable() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe('stockService', () => {
  const mockUser = { id: 'user-123' };
  const productId = 'prod-1';
  const companyId = 'comp-1';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: mockUser }, error: null } as never);
  });

  describe('darBaixa', () => {
    it('should decrease stock and log movement correctly', async () => {
      const productsTable = createProductsTable({ stock_physical: 10 });
      const logTable = createLogTable();

      vi.mocked(supabase.from).mockImplementation((table: any) => {
        if (table === 'products') return productsTable as never;
        if (table === 'stock_movement_logs') return logTable as never;
        throw new Error(`Unexpected table: ${table}`);
      });

      await stockService.darBaixa(productId, 2, companyId);

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(productsTable.select).toHaveBeenCalledWith('stock_physical');
      expect(productsTable.selectChain.eq).toHaveBeenCalledWith('id', productId);
      expect(productsTable.selectChain.eq).toHaveBeenCalledWith('company_id', companyId);
      expect(productsTable.selectChain.maybeSingle).toHaveBeenCalled();

      expect(productsTable.update).toHaveBeenCalledWith({ stock_physical: 8 });
      expect(productsTable.updateChain.eq).toHaveBeenCalledWith('id', productId);
      expect(productsTable.updateChain.eq).toHaveBeenCalledWith('company_id', companyId);

      expect(supabase.from).toHaveBeenCalledWith('stock_movement_logs');
      expect(logTable.insert).toHaveBeenCalledWith(expect.objectContaining({
        product_id: productId,
        company_id: companyId,
        user_id: mockUser.id,
        type: 'saida',
        quantity: 2,
        old_stock: 10,
        new_stock: 8,
        stock_type: 'physical',
      }));
    });

    it('should throw error if stock is insufficient', async () => {
      const productsTable = createProductsTable({ stock_physical: 1 });

      vi.mocked(supabase.from).mockImplementation((table: any) => {
        if (table === 'products') return productsTable as never;
        throw new Error(`Unexpected table: ${table}`);
      });

      await expect(stockService.darBaixa(productId, 2, companyId)).rejects.toThrow('Estoque insuficiente');
    });

    it('should throw error if product is not found', async () => {
      const productsTable = createProductsTable(null);

      vi.mocked(supabase.from).mockImplementation((table: any) => {
        if (table === 'products') return productsTable as never;
        throw new Error(`Unexpected table: ${table}`);
      });

      await expect(stockService.darBaixa(productId, 1, companyId)).rejects.toThrow('Produto não encontrado');
    });
  });
});
