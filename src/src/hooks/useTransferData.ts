import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { stockService } from "@/services/stock";

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
    queryFn: () => stockService.fetchTransferOrders(companyId as string),
  });
}

export function useCreateTransferOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: (params: { items: TransferItem[]; notes?: string }) => {
      if (!companyId) throw new Error("Empresa não identificada");
      return stockService.createTransferOrder({ ...params, companyId: companyId as string });
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
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => {
      if (!companyId) throw new Error("Empresa não identificada");
      return stockService.updateTransferStatus(id, status, companyId as string);
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
