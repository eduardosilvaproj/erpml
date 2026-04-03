import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";

interface PlanProtectedRouteProps {
  children: React.ReactNode;
  path: string;
}

export function PlanProtectedRoute({ children, path }: PlanProtectedRouteProps) {
  const { isRouteAllowed, isLoading, planName } = usePlanFeatures();
  const { toast } = useToast();
  const toastShown = useRef(false);

  const allowed = isRouteAllowed(path);

  useEffect(() => {
    if (!isLoading && !allowed && !toastShown.current) {
      toastShown.current = true;
      toast({
        title: "Módulo não disponível",
        description: `Seu plano ${planName || "atual"} não inclui este módulo. Faça upgrade para acessar.`,
        variant: "destructive",
      });
    }
  }, [isLoading, allowed, planName, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/upgrade" replace />;
  }

  return <>{children}</>;
}
