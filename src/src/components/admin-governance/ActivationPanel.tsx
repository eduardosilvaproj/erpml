import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToggleCompanyStatus } from "@/hooks/useCompanyData";

export const ActivationPanel = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const toggleMutation = useToggleCompanyStatus();

  const { data: companies, isLoading, error, refetch } = useQuery({
    queryKey: ["governance-activation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, status, cnpj, is_test")
        .eq("is_test", false) // Filtra apenas empresas reais
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleToggle = async (company: any) => {
    const newStatus = company.status === "active" ? "suspended" : "active";
    try {
      await toggleMutation.mutateAsync({ id: company.id, status: newStatus });
      
      // Audit Log
      await supabase.from("admin_audit_log").insert({
        actor_id: user?.id,
        target_type: "company",
        target_id: company.id,
        action: newStatus === "active" ? "activate" : "deactivate",
        old_value: { status: company.status },
        new_value: { status: newStatus },
        metadata: { company_name: company.name }
      });
      
      toast.success("Status atualizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["governance-activation"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ativação / Desativação de Empresas</CardTitle>
        <CardDescription>Controle o ciclo de vida e acesso das empresas à plataforma</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg bg-destructive/5">
            <PowerOff className="h-10 w-10 mx-auto mb-4 text-destructive opacity-50" />
            <h3 className="text-lg font-semibold text-destructive mb-2">Falha ao carregar empresas</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              {error instanceof Error ? error.message : "Ocorreu um erro inesperado ao carregar os dados de ativação."}
            </p>
            <Button variant="outline" onClick={() => refetch()} className="gap-2">
              <Loader2 className="h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Status Atual</TableHead>
                <TableHead className="text-right">Ações de Controle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies?.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {company.name}
                      {company.is_test && <Badge variant="outline" className="text-[10px] h-4 border-blue-500 text-blue-600">Teste</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{company.cnpj || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={company.status === "active" ? "default" : "destructive"}>
                      {company.status === "active" ? "Ativa" : "Suspensa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant={company.status === "active" ? "destructive" : "default"} 
                          size="sm"
                          className="gap-2"
                        >
                          {company.status === "active" ? (
                            <><PowerOff className="h-4 w-4" /> Desativar</>
                          ) : (
                            <><Power className="h-4 w-4" /> Ativar</>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {company.status === "active" ? "Confirmar Desativação" : "Confirmar Ativação"}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {company.status === "active" 
                              ? `Tem certeza que deseja desativar a empresa ${company.name}? Isso bloqueará o acesso de todos os seus usuários.`
                              : `Deseja ativar a empresa ${company.name}? Isso restaurará o acesso de seus usuários.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleToggle(company)}
                          >
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
