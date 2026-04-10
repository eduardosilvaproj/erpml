import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface TransferItem {
  productId: string;
  productName: string;
  productSku: string;
  barcode: string | null;
  quantity: number;
  stockPhysical: number;
}

export interface TransferOrder {
  id: string;
  order_number: string;
  status: string;
  total_items: number;
  total_quantity: number;
  notes: string | null;
  created_at: string;
  sent_at: string | null;
  received_at: string | null;
  confirmed_at: string | null;
  company_id: string | null;
  transfer_items?: {
    id: string;
    product_id: string;
    quantity: number;
    products?: { id: string; name: string; sku: string; barcode: string | null };
  }[];
}

export function useTransferOrders() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["transfer-orders", companyId],
    queryFn: async () => {
      let query = supabase
        .from("transfer_orders")
        .select("*, transfer_items(*, products(id, name, sku, barcode))")
        .order("created_at", { ascending: false });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as TransferOrder[];
    },
  });
}

export function useCreateTransferOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: async ({ items, notes }: { items: TransferItem[]; notes?: string }) => {
      for (const item of items) {
        const { data: product } = await supabase
          .from("products")
          .select("stock_physical")
          .eq("id", item.productId)
          .single();
        if (!product || product.stock_physical < item.quantity) {
          throw new Error(`Estoque insuficiente para "${item.productName}". Disponível: ${product?.stock_physical ?? 0}, Solicitado: ${item.quantity}`);
        }
      }

      const orderNumber = `TRF-${Date.now().toString(36).toUpperCase()}`;

      const { data: order, error } = await supabase
        .from("transfer_orders")
        .insert({
          order_number: orderNumber,
          status: "separando",
          total_items: items.length,
          total_quantity: items.reduce((sum, i) => sum + i.quantity, 0),
          company_id: companyId,
          notes: notes || null,
        })
        .select()
        .single();
      if (error) throw error;

      const transferItems = items.map((i) => ({
        transfer_order_id: order.id,
        product_id: i.productId,
        quantity: i.quantity,
      }));
      const { error: itemsErr } = await supabase.from("transfer_items").insert(transferItems);
      if (itemsErr) throw itemsErr;

      for (const item of items) {
        const { data: current } = await supabase
          .from("products")
          .select("stock_physical, stock_full")
          .eq("id", item.productId)
          .single();
        if (current) {
          await supabase
            .from("products")
            .update({
              stock_physical: current.stock_physical - item.quantity,
              stock_full: current.stock_full + item.quantity,
            })
            .eq("id", item.productId);
        }
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Ordem de envio criada! Estoque movimentado." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro na transferência", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateTransferStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, any> = { status };
      if (status === "enviado") updates.sent_at = new Date().toISOString();
      if (status === "recebido_full") updates.received_at = new Date().toISOString();
      if (status === "conferido_full") updates.confirmed_at = new Date().toISOString();

      const { error } = await supabase.from("transfer_orders").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfer-orders"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });
}
