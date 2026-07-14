import { ReactNode } from "react";
import { useAdminMasterDev } from "@/hooks/useAdminMasterDev";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import LoadingScreen from "@/components/LoadingScreen";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminMasterDevGuardProps {
  children: ReactNode;
}

export function AdminMasterDevGuard({ children }: AdminMasterDevGuardProps) {
  const { loading: authLoading, user } = useAuth();
  const { data: isAdminMasterDev, isLoading: roleLoading } = useAdminMasterDev();

  if (authLoading || roleLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdminMasterDev) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
        <div className="bg-destructive/10 p-4 rounded-full">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
        <p className="text-muted-foreground max-w-md">
          Você não possui as permissões de "Admin Master (Dev)" necessárias para acessar esta área técnica.
        </p>
        <Button onClick={() => window.location.href = "/"}>
          Voltar para o Início
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
