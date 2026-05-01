import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, user } = useAuth();
  const location = useLocation();

  const { data: hasCompany, isLoading: checkingCompany } = useQuery({
    queryKey: ["has-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("company_members")
        .select("id")
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .limit(1);
      return (data && data.length > 0);
    },
  });

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["is-admin-route-check", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  if (loading || (session && (checkingCompany || checkingAdmin))) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Admins can access admin routes without a company
  const adminRoutes = ["/admin", "/master-admin", "/admin/painel-controle"];
  const allowedWithoutCompany = ["/onboarding", "/boas-vindas"];

  if (!hasCompany && !isAdmin && !allowedWithoutCompany.includes(location.pathname)) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!hasCompany && isAdmin && !allowedWithoutCompany.includes(location.pathname) && !adminRoutes.includes(location.pathname)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
