import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type CartItem = {
  productId: string;
  productName: string;
  productSku: string;
  barcode: string | null;
  quantity: number;
  unitPrice: number;
  stockPhysical: number;
};

export function useSales(filters?: { dateFrom?: string; dateTo?: string; limit?: number }) {
  return useQuery({
    queryKey: ["sales", filters],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("*, sale_items(*, products(id, name, sku)), customers(id, name)")
        .order("created_at", { ascending: false });

      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo + "T23:59:59");
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useSalesStats() {
  return useQuery({
    queryKey: ["sales-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data: allSales, error } = await supabase
        .from("sales")
        .select("total_value, created_at")
        .gte("created_at", thirtyDaysAgo);
      if (error) throw error;

      const todaySales = allSales?.filter((s) => s.created_at.startsWith(today)) || [];
      const totalToday = todaySales.reduce((sum, s) => sum + Number(s.total_value), 0);
      const total30d = allSales?.reduce((sum, s) => sum + Number(s.total_value), 0) || 0;

      return {
        salesToday: todaySales.length,
        revenueToday: totalToday,
        sales30d: allSales?.length || 0,
        revenue30d: total30d,
      };
    },
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      items,
      paymentMethod,
      customerId,
      discount,
    }: {
      items: CartItem[];
      paymentMethod: string;
      customerId?: string;
      discount?: number;
    }) => {
      const totalValue = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) - (discount || 0);
      const saleNumber = `VND-${Date.now().toString(36).toUpperCase()}`;

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          sale_number: saleNumber,
          customer_id: customerId || null,
          total_value: Math.max(0, totalValue),
          discount: discount || 0,
          payment_method: paymentMethod,
          status: "finalizada",
        })
        .select()
        .single();
      if (saleError) throw saleError;

      // Create sale items
      const saleItems = items.map((item) => ({
        sale_id: sale.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.unitPrice * item.quantity,
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(saleItems);
      if (itemsError) throw itemsError;

      // Deduct from physical stock
      for (const item of items) {
        const { data: current } = await supabase
          .from("products")
          .select("stock_physical")
          .eq("id", item.productId)
          .single();
        if (current) {
          await supabase
            .from("products")
            .update({ stock_physical: Math.max(0, current.stock_physical - item.quantity) })
            .eq("id", item.productId);
        }
      }

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Venda finalizada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao finalizar venda", description: error.message, variant: "destructive" });
    },
  });
}
