import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
// callAdminUsersFunction import removed as it's not used here

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
  owner_id: string | null;
  is_courtesy: boolean;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: "owner" | "manager" | "member" | "admin_master";
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

      // Fetch company, plan, and member count in parallel
      const [companyRes, countRes, plansRes] = await Promise.all([
        supabase.from("companies").select("*").eq("id", membership.company_id).maybeSingle(),
        supabase.from("company_members").select("*", { count: "exact", head: true }).eq("company_id", membership.company_id).eq("is_active", true),
        supabase.from("plans").select("*"),
      ]);

      if (companyRes.error || !companyRes.data) return null;
      const company = companyRes.data;

      let plan: Plan | undefined;
      if (company.plan_id) {
        const planData = plansRes.data?.find((p: any) => p.id === company.plan_id);
        if (planData) {
          plan = {
            ...planData,
            features: Array.isArray(planData.features) ? planData.features as string[] : JSON.parse(String(planData.features || "[]")),
          } as Plan;
        }
      }

      return { ...company, plan, members_count: countRes.count || 0 } as Company & { plan?: Plan; members_count?: number };
    },
  });
}

export function useCompanyMembers(companyId?: string) {
  return useQuery({
    queryKey: ["company-members", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<(CompanyMember & { profile?: { full_name: string | null; email?: string; avatar_url?: string | null } })[]> => {
      const { data, error } = await supabase
        .from("company_members")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Get profiles for members
      const userIds = (data || []).map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      return (data || []).map((m: any) => ({
        ...m,
        profile: profiles?.find((p: any) => p.id === m.user_id),
      }));
    },
  });
}

export function useCompanyAuditLog(companyId?: string) {
  return useQuery({
    queryKey: ["company-audit-log", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<(AuditLogEntry & { user_name?: string })[]> => {
      const { data, error } = await supabase
        .from("company_audit_log")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const entries = (data || []).map((d: any) => ({ ...d, details: d.details as Record<string, unknown> | null })) as AuditLogEntry[];

      // Fetch user names
      const userIds = [...new Set(entries.map((e) => e.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        return entries.map((e) => ({
          ...e,
          user_name: profiles?.find((p: any) => p.id === e.user_id)?.full_name || undefined,
        }));
      }
      return entries;
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Company> & { id: string }) => {
      const { error } = await supabase
        .from("companies")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;

      // Add audit log
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error: auditErr } = await supabase.from("company_audit_log").insert({
          company_id: id,
          user_id: session.user.id,
          action: "company_updated",
          details: updates as any,
        });
        if (auditErr) {
          console.error("Erro no audit log:", auditErr);
          throw new Error(`Erro ao registrar log de auditoria: ${auditErr.message}`);
        }
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
    mutationFn: async (data: { name: string; plan_id: string; is_test?: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      // Use the new atomic function to create company, membership and sync profile
      const { data: company, error } = await supabase.rpc('create_company_v2', {
        p_name: data.name,
        p_plan_id: data.plan_id,
        p_is_test: data.is_test || false
      });

      if (error) {
        console.error("Erro ao criar empresa via RPC:", error);
        throw error;
      }

      return company;
    },
    onSuccess: (company) => {
      // Update cache immediately to avoid race conditions on redirect
      if (company && company.owner_id) {
        queryClient.setQueryData(["has-company", company.owner_id], true);
        queryClient.setQueryData(["profile-company-id", company.owner_id], { company_id: company.id });
      }

      // Invalidate all related queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
      queryClient.invalidateQueries({ queryKey: ["has-company"] });
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
      queryClient.invalidateQueries({ queryKey: ["profile-company-id"] });
    },
  });
}

// Admin: all companies
export function useAllCompanies() {
  return useQuery({
    queryKey: ["all-companies"],
    queryFn: async (): Promise<(Company & { plan?: Plan; members_count?: number; owner_profile?: { full_name: string | null } })[]> => {
      // Fetch companies, plans, profiles, and all active members in parallel (no N+1)
      const [companiesRes, plansRes, membersRes] = await Promise.all([
        supabase.from("companies").select("*").order("created_at", { ascending: false }),
        supabase.from("plans").select("*"),
        supabase.from("company_members").select("company_id").eq("is_active", true),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      const data = companiesRes.data || [];
      const plans = plansRes.data || [];

      // Get owner profiles in a single query
      const ownerIds = [...new Set(data.map((c: any) => c.owner_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds);

      // Count members per company client-side
      const memberCountMap: Record<string, number> = {};
      for (const m of membersRes.data || []) {
        memberCountMap[m.company_id] = (memberCountMap[m.company_id] || 0) + 1;
      }

      return data.map((c: any) => {
        const plan = plans.find((p: any) => p.id === c.plan_id);
        const ownerProfile = profiles?.find((p: any) => p.id === c.owner_id);
        return {
          ...c,
          plan: plan ? { ...plan, features: Array.isArray(plan.features) ? plan.features : [] } : undefined,
          members_count: memberCountMap[c.id] || 0,
          owner_profile: ownerProfile || null,
        };
      });
    },
  });
}

export function useAdminUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Company> & { id: string }) => {
      const { error } = await supabase
        .from("companies")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-companies"] });
      queryClient.invalidateQueries({ queryKey: ["governance-companies"] });
    },
  });
}

export function useAdminChangeCompanyPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, planId }: { companyId: string; planId: string }) => {
      const { error } = await supabase
        .from("companies")
        .update({ 
          plan_id: planId,
          is_test: false // Clear test flag when plan is explicitly changed by admin
        })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-companies"] });
      queryClient.invalidateQueries({ queryKey: ["governance-companies"] });
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
    },
  });
}

export function useToggleCompanyStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "suspended" | "cancelled" }) => {
      const { error } = await supabase
        .from("companies")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-companies"] });
      queryClient.invalidateQueries({ queryKey: ["governance-companies"] });
    },
  });
}

export function useUpdatePlan() {
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
      queryClient.invalidateQueries({ queryKey: ["all-plans"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

// useAdminResetPassword foi movido para useAdminData.ts para centralização de ações administrativas

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-companies"] });
    },
  });
}

export function useAdminActivateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, planId, isCourtesy }: { companyId: string; planId: string; isCourtesy: boolean }) => {
      const { error } = await supabase.rpc('admin_activate_company', {
        p_company_id: companyId,
        p_plan_id: planId,
        p_is_courtesy: isCourtesy
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-companies"] });
      queryClient.invalidateQueries({ queryKey: ["governance-companies"] });
    },
  });
}
