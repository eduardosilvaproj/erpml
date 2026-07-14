import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { callAdminUsersFunction } from "@/utils/admin-users-api";

export { callAdminUsersFunction };

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  full_name: string;
  company_id: string | null;
  company_name: string | null;
  membership_role: string | null;
  owned_company_id: string | null;
  roles: string[];
}

const callAdminFunction = callAdminUsersFunction;


export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<AdminUser[]> => {
      const result = await callAdminUsersFunction<{ users: AdminUser[] }>("list-users");
      return result.users ?? [];
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => callAdminUsersFunction("delete-user", { targetUserId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useIsAdmin() {
  const { hasPlatformAdminAccess, isLoading } = useHasAdminAccess();
  return { data: hasPlatformAdminAccess, isLoading };
}

// Hook unificado para verificar qualquer acesso administrativo
export function useHasAdminAccess() {
  const { user } = useAuth();
  
  const query = useQuery({
    queryKey: ["platform-admin-access", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { isAdmin: false, isAdminMaster: false, hasPlatformAdminAccess: false };
      
      const [userRoles, companyMembers] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("company_members").select("role").eq("user_id", user.id).eq("is_active", true)
      ]);
      
      const roles = (userRoles.data as any[])?.map(r => r.role) || [];
      const companyRoles = (companyMembers.data as any[])?.map(r => r.role) || [];
      
      const isAdmin = roles.includes('admin');
      const isAdminMasterInUserRoles = roles.includes('admin_master');
      const isAdminMasterInCompany = companyRoles.includes('admin_master');
      
      const isAdminMaster = isAdminMasterInUserRoles || isAdminMasterInCompany;
      const hasPlatformAdminAccess = isAdmin || isAdminMaster;
      
      return { isAdmin, isAdminMaster, hasPlatformAdminAccess };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    hasAccess: !!query.data?.hasPlatformAdminAccess,
    hasPlatformAdminAccess: !!query.data?.hasPlatformAdminAccess,
    isLoading: query.isLoading,
    isAdmin: !!query.data?.isAdmin,
    isAdminMaster: !!query.data?.isAdminMaster
  };
}

export function useAdminResetPassword() {
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      return callAdminUsersFunction("set-password", { targetUserId, passwordMode: "temporary" });
    },
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => callAdminUsersFunction("create-user", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => callAdminUsersFunction("update-user", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-companies"] });
    },
  });
}

export function useSetUserPassword() {
  return useMutation({
    mutationFn: (data: { targetUserId: string; passwordMode: "manual" | "temporary"; password?: string }) => 
      callAdminUsersFunction("set-password", data),
  });
}

export function usePendingUsers(enabled = true) {
  const { hasAccess: isActuallyAdmin } = useHasAdminAccess();
  return useQuery({
    queryKey: ["pending-users"],
    refetchInterval: (enabled && isActuallyAdmin) ? 30000 : false,
    enabled: !!(enabled && isActuallyAdmin),
    queryFn: async () => {
      try {
        const result = await callAdminUsersFunction<{ users: any[] }>("list-pending-users");
        return result.users ?? [];
      } catch (error: any) {
        const forbiddenMessages = ["Não autorizado", "Acesso negado. Apenas administradores."];
        if (forbiddenMessages.some(msg => error.message?.includes(msg))) {
          console.warn("[useAdminData] Access denied to pending users, returning empty list.");
          return [];
        }
        throw error;
      }
    },
  });
}

export function useCreateCompanyForUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { targetUserId: string; companyName: string; planId?: string }) => 
      callAdminUsersFunction("create-company-for-user", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-companies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

// Legacy compatibility
export function useToggleRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ targetUserId, role }: { targetUserId: string; role: string }) => 
      callAdminUsersFunction("update-user", { targetUserId, role: role === 'admin' ? 'admin_master' : role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

// callAdminFunction is already defined above at line 69
