import { useState } from "react";
import { useCompanyMembers, useMyCompany } from "@/hooks/useCompanyData";
import { getAvatarUrl } from "@/components/AvatarUpload";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Users, UserCheck, UserX, UserPlus, Trash2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const roleLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  owner: { label: "Proprietário", variant: "default" },
  manager: { label: "Gerente", variant: "secondary" },
  member: { label: "Membro", variant: "outline" },
};

export default function Equipe() {
  const { user } = useAuth();
  const { data: company, isLoading: loadingCompany } = useMyCompany();
  const { data: members, isLoading: loadingMembers } = useCompanyMembers(company?.id);
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isLoading = loadingCompany || loadingMembers;
  const activeCount = members?.filter((m) => m.is_active).length || 0;
  const isOwner = company?.owner_id === user?.id;

  const callEdgeFunction = async (action: string, body: Record<string, string>) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-member?action=${action}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ companyId: company!.id, ...body }),
      }
    );
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Erro");
    return result;
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !company?.id) return;
    setInviting(true);
    try {
      await callEdgeFunction("invite", { email: inviteEmail.trim(), role: inviteRole });
      toast.success("Membro adicionado com sucesso!");
      setInviteEmail("");
      setInviteRole("member");
      setInviteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!company?.id) return;
    setRemovingId(memberId);
    try {
      await callEdgeFunction("remove", { memberId });
      toast.success("Membro removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRemovingId(null);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    if (!company?.id) return;
    try {
      await callEdgeFunction("change-role", { memberId, newRole });
      toast.success("Papel alterado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["company-members"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Equipe</h1>
          <p className="text-muted-foreground">Membros da sua empresa</p>
        </div>
        {isOwner && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar Membro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Membro</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">E-mail do usuário</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="usuario@exemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    maxLength={255}
                  />
                  <p className="text-xs text-muted-foreground">
                    O usuário precisa ter uma conta cadastrada no sistema.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Papel</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="manager">Gerente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membros Ativos</CardTitle>
            <UserCheck className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
          <CardDescription>
            {company?.name ? `Equipe de ${company.name}` : "Carregando..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !members?.length ? (
            <p className="text-muted-foreground text-center py-8">Nenhum membro encontrado.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => {
                const initials = (member.profile?.full_name || "?")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const role = roleLabels[member.role] || { label: member.role, variant: "outline" as const };
                const canRemove = isOwner && member.role !== "owner" && member.user_id !== user?.id && member.is_active;
                const canChangeRole = isOwner && member.role !== "owner" && member.is_active;

                return (
                  <Card key={member.id} className="flex items-center gap-4 p-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={undefined} alt={member.profile?.full_name || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {member.profile?.full_name || "Sem nome"}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {canChangeRole ? (
                          <Select
                            value={member.role}
                            onValueChange={(val) => handleChangeRole(member.id, val)}
                          >
                            <SelectTrigger className="h-6 w-auto text-xs px-2 gap-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Membro</SelectItem>
                              <SelectItem value="manager">Gerente</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={role.variant}>{role.label}</Badge>
                        )}
                        {member.is_active ? (
                          <Badge variant="outline" className="text-accent border-accent/30">
                            <UserCheck className="h-3 w-3 mr-1" /> Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <UserX className="h-3 w-3 mr-1" /> Inativo
                          </Badge>
                        )}
                      </div>
                    </div>
                    {canRemove && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive">
                            {removingId === member.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {member.profile?.full_name || "Este membro"} será removido da equipe. Essa ação pode ser revertida convidando-o novamente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRemove(member.id)}>
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
