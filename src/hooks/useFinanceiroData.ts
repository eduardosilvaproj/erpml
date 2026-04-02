import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useInvoicesWithPayments() {
  return useQuery({
    queryKey: ["invoices-with-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, invoice_payments(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePayments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payments: {
      invoice_id: string;
      due_date: string | null;
      amount: number;
      is_cash: boolean;
      status: string;
      paid_at: string | null;
      installment_number: number;
    }[]) => {
      const { data, error } = await supabase
        .from("invoice_payments")
        .insert(payments)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices-with-payments"] });
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      status?: string;
      paid_at?: string | null;
      is_cash?: boolean;
      due_date?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("invoice_payments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices-with-payments"] });
    },
  });
}