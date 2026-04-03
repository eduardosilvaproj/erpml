import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export function useInvoicesWithPayments() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["invoices-with-payments", companyId],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, invoice_payments(*)")
        .order("created_at", { ascending: false });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
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
