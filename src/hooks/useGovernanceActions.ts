import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Company, Plan } from "@/hooks/useCompanyData";
import { callAdminUsersFunction } from "@/utils/admin-users-api";

export function useGovernanceCompanies(search?: string) {
  return useQuery({
    queryKey: ["governance-companies", search],
    queryFn: async () => {
      let query = supabase
        .from("companies")
        .select(`
          *,
          plans (id, name, price, slug)
        `)
        .eq("is_test", false); // Only real companies in governance view

      if (search) {
        query = query.or(`name.ilike.%${search}%,cnpj.ilike.%${search}%`);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      
      // Get owner profiles for all companies in one go
      const ownerIds = [...new Set(data.map(c => c.owner_id).filter(Boolean))];
      let profiles: any[] = [];
      if (ownerIds.length > 0) {
        const { data: pData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ownerIds);
        profiles = pData || [];
      }

      return data.map(c => ({
        ...c,
        plan: (c as any).plans,
        owner_profile: profiles.find(p => p.id === c.owner_id) || null
      }));
    },
  });
}

export function useAdminCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Company>) => callAdminUsersFunction("create-company", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-companies"] });
      queryClient.invalidateQueries({ queryKey: ["all-companies"] });
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["all-plans"] });
      toast.success("Empresa criada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar empresa: " + err.message);
    }
  });
}

export function useAdminAssignOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, userId }: { companyId: string, userId: string }) => {
      const { error } = await supabase.rpc('admin_assign_company_owner', {
        p_company_id: companyId,
        p_user_id: userId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-companies"] });
      queryClient.invalidateQueries({ queryKey: ["all-companies"] });
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Dono atribuído com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao atribuir dono: " + err.message);
    }
  });
}

export function useGovernancePlans() {
  return useQuery({
    queryKey: ["governance-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("price", { ascending: true });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : JSON.parse(p.features || "[]"),
      }));
    },
  });
}

export function useAdminUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Plan> & { id: string }) => {
      const { error } = await supabase
        .from("plans")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-plans"] });
      queryClient.invalidateQueries({ queryKey: ["all-plans"] });
      toast.success("Plano atualizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar plano: " + err.message);
    }
  });
}
