import { useState } from "react";
import { usePendingUsers, useCreateCompanyForUser } from "@/hooks/useAdminData";
import { usePlans } from "@/hooks/useCompanyData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, UserCheck, UserX, Building2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PendingUsersTab() {
  const { data: pendingUsers, isLoading, error, refetch } = usePendingUsers();
  const { data: plans } = usePlans();
  const createCompany = useCreateCompanyForUser();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; full_name: string; email: string } | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const openCreateDialog = (user: { id: string; full_name: string; email: string }) => {
    setSelectedUser(user);
    setCompanyName(user.full_name ? `Empresa ${user.full_name}` : "");
    setSelectedPlanId("");
    setDialogOpen(true);
  };

  const handleCreateCompany = async () => {
    if (!selectedUser || !companyName.trim()) return;
    try {
      await createCompany.mutateAsync({
        targetUserId: selectedUser.id,
        companyName: companyName.trim(),
        planId: selectedPlanId || undefined,
      });
      toast.success("Empresa criada com sucesso!");
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Usuários Pendentes
          </CardTitle>
          <CardDescription>
            Usuários registrados que ainda não completaram o onboarding. Crie uma empresa em nome deles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-destructive/5">
              <UserX className="h-10 w-10 mx-auto mb-4 text-destructive opacity-50" />
              <h3 className="text-lg font-semibold text-destructive mb-2">Falha ao carregar usuários pendentes</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                {error instanceof Error ? error.message : "Ocorreu um erro inesperado ao buscar os usuários pendentes."}
              </p>
              <Button variant="outline" onClick={() => refetch()} className="gap-2">
                <Loader2 className="h-4 w-4" /> Tentar novamente
              </Button>
            </div>
          ) : !pendingUsers?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck className="h-10 w-10 mx-auto mb-2 text-accent" />
              <p>Todos os usuários já possuem empresa!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Status E-mail</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        {u.email_confirmed_at ? (
                          <Badge variant="default" className="bg-accent text-accent-foreground">
                            <UserCheck className="h-3 w-3 mr-1" /> Confirmado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <UserX className="h-3 w-3 mr-1" /> Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.created_at
                          ? format(new Date(u.created_at), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => openCreateDialog(u)}
                          disabled={createCompany.isPending}
                        >
                          <Building2 className="h-3 w-3 mr-1" /> Criar Empresa
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Empresa para Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-muted-foreground text-xs">Usuário</Label>
              <p className="font-medium">{selectedUser?.full_name || selectedUser?.email}</p>
              <p className="text-xs text-muted-foreground">{selectedUser?.email}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Nome da Empresa</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.price === 0 ? "Grátis" : `R$ ${p.price.toFixed(2)}/mês`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCompany} disabled={!companyName.trim() || createCompany.isPending}>
              {createCompany.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Criar Empresa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
