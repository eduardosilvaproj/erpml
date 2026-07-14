import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHasAdminAccess } from "@/hooks/useAdminData";

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

  const { hasAccess: isAdmin, isLoading: checkingAdmin } = useHasAdminAccess();

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
  const adminRoutes = ["/master-admin"];
  const allowedWithoutCompany = ["/onboarding", "/boas-vindas"];

  if (!hasCompany && !isAdmin && !allowedWithoutCompany.includes(location.pathname)) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!hasCompany && isAdmin && !allowedWithoutCompany.includes(location.pathname) && !adminRoutes.includes(location.pathname)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
