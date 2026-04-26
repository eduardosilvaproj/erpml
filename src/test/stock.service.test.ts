import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stockService } from '../services/stock';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('stockService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('darBaixa', () => {
    it('should decrease stock and log movement', async () => {
      const mockProduct = { stock_physical: 10 };
      const mockUser = { user: { id: 'user-123' } };
      
      const fromMock = vi.mocked(supabase.from);
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProduct, error: null }),
      });
      
      fromMock.mockReturnValue({
        select: selectMock,
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      } as any);

      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: mockUser, error: null } as any);

      await stockService.darBaixa('prod-1', 2, 'comp-1');

      expect(supabase.from).toHaveBeenCalledWith('products');
      expect(supabase.from).toHaveBeenCalledWith('stock_movement_logs');
    });

    it('should throw error if stock is insufficient', async () => {
      const mockProduct = { stock_physical: 1 };
      
      const fromMock = vi.mocked(supabase.from);
      fromMock.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProduct, error: null }),
      } as any);

      await expect(stockService.darBaixa('prod-1', 2, 'comp-1')).rejects.toThrow('Estoque insuficiente');
    });
  });
});
