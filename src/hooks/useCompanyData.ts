import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  max_users: number;
  max_products: number;
  features: string[];
  is_active: boolean;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  plan_id: string | null;
  status: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  company_id: string;
  user_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : JSON.parse(p.features || "[]"),
      }));
    },
  });
}

export function useAllPlans() {
  return useQuery({
    queryKey: ["all-plans"],
    queryFn: async (): Promise<Plan[]> => {
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

export function useMyCompany() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-company", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<(Company & { plan?: Plan; members_count?: number }) | null> => {
      // Find company where user is a member
      const { data: membership } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!membership) return null;

      const { data: company, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", membership.company_id)
        .single();

      if (error || !company) return null;

      // Get plan
      let plan: Plan | undefined;
      if (company.plan_id) {
        const { data: planData } = await supabase
          .from("plans")
          .select("*")
          .eq("id", company.plan_id)
          .single();
        if (planData) {
          plan = {
            ...planData,
            features: Array.isArray(planData.features) ? planData.features : JSON.parse(planData.features || "[]"),
          } as Plan;
        }
      }

      // Get members count
      const { count } = await supabase
        .from("company_members")
        .select("*", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("is_active", true);

      return { ...company, plan, members_count: count || 0 } as Company & { plan?: Plan; members_count?: number };
    },
  });
}

export function useCompanyMembers(companyId: string | undefined) {
  return useQuery({
    queryKey: ["company-members", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<(CompanyMember & { profile?: { full_name: string | null; email?: string } })[]> => {
      const { data, error } = await supabase
        .from("company_members")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Get profiles for members
      const userIds = (data || []).map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      return (data || []).map((m: any) => ({
        ...m,
        profile: profiles?.find((p: any) => p.id === m.user_id),
      }));
    },
  });
}

export function useCompanyAuditLog(companyId: string | undefined) {
  return useQuery({
    queryKey: ["company-audit-log", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data, error } = await supabase
        .from("company_audit_log")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Company> & { id: string }) => {
      const { error } = await supabase
        .from("companies")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // Add audit log
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("company_audit_log").insert({
          company_id: id,
          user_id: session.user.id,
          action: "company_updated",
          details: updates as any,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
      queryClient.invalidateQueries({ queryKey: ["company-audit-log"] });
    },
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; plan_id: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const { data: company, error } = await supabase
        .from("companies")
        .insert({
          name: data.name,
          plan_id: data.plan_id,
          owner_id: session.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add owner as member
      await supabase.from("company_members").insert({
        company_id: company.id,
        user_id: session.user.id,
        role: "owner",
      });

      // Add audit log
      await supabase.from("company_audit_log").insert({
        company_id: company.id,
        user_id: session.user.id,
        action: "company_created",
        details: { name: data.name },
      });

      return company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
    },
  });
}

// Admin: all companies
export function useAllCompanies() {
  return useQuery({
    queryKey: ["all-companies"],
    queryFn: async (): Promise<(Company & { plan?: Plan; members_count?: number })[]> => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: plans } = await supabase.from("plans").select("*");

      // Get member counts per company
      const companiesWithData = await Promise.all(
        (data || []).map(async (c: any) => {
          const { count } = await supabase
            .from("company_members")
            .select("*", { count: "exact", head: true })
            .eq("company_id", c.id);

          const plan = plans?.find((p: any) => p.id === c.plan_id);
          return {
            ...c,
            plan: plan ? { ...plan, features: Array.isArray(plan.features) ? plan.features : [] } : undefined,
            members_count: count || 0,
          };
        })
      );

      return companiesWithData;
    },
  });
}

export function useToggleCompanyStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("companies")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-companies"] });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Plan> & { id: string }) => {
      const { error } = await supabase
        .from("plans")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-plans"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}
