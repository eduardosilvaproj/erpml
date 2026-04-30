import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  company_id: string | null;
};

export function useCustomers(search?: string) {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["customers", search, companyId],
    queryFn: async () => {
      let query = supabase.from("customers").select("*").order("name");
      if (companyId) {
        query = query.eq("company_id", companyId);
      }
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useCustomerWithPurchases(customerId?: string) {
  return useQuery({
    queryKey: ["customer-purchases", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(*, products(id, name, sku))")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCustomerStats() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["customer-stats", companyId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      let query = supabase.from("customers").select("created_at");
      if (companyId) {
        query = query.eq("company_id", companyId);
      }
      const { data: all, error } = await query;
      if (error) throw error;

      let salesQuery = supabase
        .from("sales")
        .select("id")
        .not("customer_id", "is", null)
        .gte("created_at", thirtyDaysAgo);
      if (companyId) {
        salesQuery = salesQuery.eq("company_id", companyId);
      }
      const { data: sales30d } = await salesQuery;

      return {
        total: all?.length || 0,
        new30d: all?.filter((c) => c.created_at >= thirtyDaysAgo).length || 0,
        purchases30d: sales30d?.length || 0,
      };
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: async (data: { name: string; phone?: string; email?: string; cpf?: string; address?: string; notes?: string }) => {
      const { data: customer, error } = await supabase
        .from("customers")
        .insert({
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          cpf: data.cpf || null,
          address: data.address || null,
          notes: data.notes || null,
          company_id: companyId,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-stats"] });
      toast({ title: "Cliente cadastrado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao cadastrar cliente", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; phone?: string; email?: string; cpf?: string; address?: string; notes?: string } }) => {
      const { error } = await supabase.from("customers").update({
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        cpf: data.cpf || null,
        address: data.address || null,
        notes: data.notes || null,
      }).eq("id", id).eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Cliente atualizado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id).eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-stats"] });
      toast({ title: "Cliente excluído!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });
}
