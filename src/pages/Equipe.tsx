import { useState } from "react";
import { useCompanyMembers, useMyCompany } from "@/hooks/useCompanyData";
import { getAvatarUrl } from "@/components/AvatarUpload";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Loader2, Users, UserCheck, Clock, UserPlus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const roleBadge: Record<string, { label: string; className: string }> = {
  owner: { label: "Proprietário", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  manager: { label: "Gerente", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  member: { label: "Membro", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
};

const moduleDefaults = { produtos: "ver", estoque: "ver", vendas: "ver", relatorios: "ver", financeiro: "sem" };
type Permissions = Record<string, string>;

export default function Equipe() {
  const { user } = useAuth();
  const { data: company, isLoading: loadingCompany } = useMyCompany();
  const { data: members, isLoading: loadingMembers } = useCompanyMembers(company?.id);
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [invitePerms, setInvitePerms] = useState<Permissions>({ ...moduleDefaults });
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
  const [editRole, setEditRole] = useState("member");
  const [editPerms, setEditPerms] = useState<Permissions>({ ...moduleDefaults });

  const isLoading = loadingCompany || loadingMembers;
  const activeMembers = members?.filter((m) => m.is_active) || [];
  const inactiveMembers = members?.filter((m) => !m.is_active) || [];
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
      setInvitePerms({ ...moduleDefaults });
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

  const openEdit = (member: any) => {
    setEditMember(member);
    setEditRole(member.role);
    setEditPerms({ ...moduleDefaults });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editMember) return;
    try {
      await handleChangeRole(editMember.id, editRole);
      setEditOpen(false);
      setEditMember(null);
    } catch {}
  };

  const getInitials = (name: string | null | undefined) =>
    (name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const getInitialColor = (name: string | null | undefined) => {
    const colors = [
      "bg-purple-500/20 text-purple-400",
      "bg-blue-500/20 text-blue-400",
      "bg-emerald-500/20 text-emerald-400",
      "bg-amber-500/20 text-amber-400",
      "bg-rose-500/20 text-rose-400",
      "bg-cyan-500/20 text-cyan-400",
    ];
    const hash = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatDate = (d: string | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
  };

  const PermissionsSection = ({ perms, setPerms }: { perms: Permissions; setPerms: (p: Permissions) => void }) => {
    const modules = [
      { key: "produtos", label: "Produtos", options: ["ver", "editar", "sem"] },
      { key: "estoque", label: "Estoque", options: ["ver", "editar", "sem"] },
      { key: "vendas", label: "Vendas", options: ["ver", "editar", "sem"] },
      { key: "relatorios", label: "Relatórios", options: ["ver", "sem"] },
      { key: "financeiro", label: "Financeiro", options: ["ver", "sem"] },
    ];
    const optionLabels: Record<string, string> = { ver: "Ver", editar: "Editar", sem: "Sem acesso" };

    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Permissões por módulo</Label>
        <div className="space-y-2">
          {modules.map((mod) => (
            <div key={mod.key} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 p-2.5">
              <span className="text-sm">{mod.label}</span>
              <Select value={perms[mod.key] || "ver"} onValueChange={(v) => setPerms({ ...perms, [mod.key]: v })}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mod.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>{optionLabels[opt]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const allMembers = [...(members || [])];

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
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Convidar Membro</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">E-mail do usuário *</Label>
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
                  <Label htmlFor="invite-role">Nível de acesso</Label>
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
                <Separator />
                <PermissionsSection perms={invitePerms} setPerms={setInvitePerms} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar convite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <UserCheck className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeMembers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes de Aceite</CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveMembers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !allMembers.length ? (
            <p className="text-muted-foreground text-center py-8">Nenhum membro encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membro</TableHead>
                    <TableHead className="hidden md:table-cell">E-mail</TableHead>
                    <TableHead>Nível de Acesso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Desde</TableHead>
                    {isOwner && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMembers.map((member) => {
                    const name = member.profile?.full_name || "Sem nome";
                    const initials = getInitials(name);
                    const avatarColor = getInitialColor(name);
                    const role = roleBadge[member.role] || { label: member.role, className: "bg-muted text-muted-foreground" };
                    const canAct = isOwner && member.role !== "owner" && member.user_id !== user?.id;

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={getAvatarUrl(member.profile?.avatar_url)} alt={name} />
                              <AvatarFallback className={`${avatarColor} font-semibold text-xs`}>
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium truncate max-w-[160px]">{name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {(member.profile as any)?.email || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={role.className}>{role.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {member.is_active ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Ativo</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                          {formatDate(member.created_at)}
                        </TableCell>
                        {isOwner && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={!canAct}
                                onClick={() => openEdit(member)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {canAct ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                      {removingId === member.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {name} será removido da equipe. Essa ação pode ser revertida convidando-o novamente.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleRemove(member.id)}>Remover</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : (
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Member Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Membro</DialogTitle>
          </DialogHeader>
          {editMember && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={getAvatarUrl(editMember.profile?.avatar_url)} />
                  <AvatarFallback className={`${getInitialColor(editMember.profile?.full_name)} font-semibold text-xs`}>
                    {getInitials(editMember.profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{editMember.profile?.full_name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{(editMember.profile as any)?.email || "—"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nível de acesso</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />
              <PermissionsSection perms={editPerms} setPerms={setEditPerms} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
