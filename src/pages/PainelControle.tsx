import { useEffect } from "react";
import { useIsAdminMaster } from "@/hooks/useAdminMaster";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function PainelControle() {
  const { data: isAdminMaster, isLoading } = useIsAdminMaster();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAdminMaster === false) {
      toast.error("Acesso não autorizado");
      navigate("/dashboard");
    }
  }, [isAdminMaster, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminMaster) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Esta área é restrita para administradores master do sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel de Controle</h1>
        <p className="text-muted-foreground text-lg">
          Configurações globais e governança do sistema.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Configurações do Sistema</CardTitle>
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Em breve: ajuste parâmetros globais da plataforma.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
