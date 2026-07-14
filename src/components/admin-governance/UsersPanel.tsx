import { useState } from "react";
import { useAdminUsers, useDeleteUser, useSetUserPassword, useCreateAdminUser, useUpdateAdminUser, AdminUser } from "@/hooks/useAdminData";
import { useAuth } from "@/contexts/AuthContext";
import { useAllCompanies, usePlans } from "@/hooks/useCompanyData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, 
  ShieldCheck, 
  Trash2, 
  Users, 
  UserCheck, 
  UserX, 
  Loader2, 
  KeyRound, 
  Copy, 
  Pencil, 
  UserPlus, 
  Search,
  Building2,
  Lock,
  Mail,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const UsersPanel = () => {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading, error, refetch } = useAdminUsers();
  const { data: companies } = useAllCompanies();
  const deleteUser = useDeleteUser();
  const setPassword = useSetUserPassword();
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();

  const [search, setSearch] = useState("");
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{ email: string; password: string } | null>(null);
  
  // User Form Dialog State
  const [formOpen, setFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    passwordMode: "manual" as "manual" | "temporary",
    companyId: "",
    companyName: "",
    role: "member" as "owner" | "manager" | "member" | "admin_master"
  });

  // Password Dialog State
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [pwdTargetUser, setPwdTargetUser] = useState<AdminUser | null>(null);
  const [pwdData, setPwdData] = useState({
    password: "",
    passwordMode: "manual" as "manual" | "temporary"
  });

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setFormData({
      fullName: "",
      email: "",
      password: "",
      passwordMode: "manual",
      companyId: "",
      companyName: "",
      role: "member"
    });
    setFormOpen(true);
  };

  const handleOpenEdit = (u: AdminUser) => {
    setSelectedUser(u);
    setFormData({
      fullName: u.full_name,
      email: u.email,
      password: "",
      passwordMode: "manual",
      companyId: u.company_id || "",
      companyName: "",
      role: (u.roles.includes("admin") ? "admin_master" : (u.membership_role as any)) || "member"
    });
    setFormOpen(true);
  };

  const handleOpenSetPassword = (u: AdminUser) => {
    setPwdTargetUser(u);
    setPwdData({ password: "", passwordMode: "manual" });
    setPwdDialogOpen(true);
  };

  const handleFormSubmit = async () => {
    try {
      if (selectedUser) {
        // Update
        await updateUser.mutateAsync({
          targetUserId: selectedUser.id,
          fullName: formData.fullName,
          email: formData.email,
          companyId: formData.companyId,
          role: formData.role,
          password: formData.password || undefined
        });
        toast.success("Usuário atualizado com sucesso");
      } else {
        // Create
        const result = await createUser.mutateAsync(formData);
        toast.success("Usuário criado com sucesso");
        if (result.temporaryPassword) {
          setTempPasswordInfo({ email: formData.email, password: result.temporaryPassword });
        }
      }
      setFormOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSetPassword = async () => {
    if (!pwdTargetUser) return;
    try {
      const result = await setPassword.mutateAsync({
        targetUserId: pwdTargetUser.id,
        passwordMode: pwdData.passwordMode,
        password: pwdData.password
      });
      toast.success("Senha atualizada com sucesso");
      if (result.temporaryPassword) {
        setTempPasswordInfo({ email: pwdTargetUser.email, password: result.temporaryPassword });
      }
      setPwdDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteUser = async (targetUserId: string) => {
    try {
      await deleteUser.mutateAsync(targetUserId);
      toast.success("Usuário excluído com sucesso");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const copyPassword = async () => {
    if (!tempPasswordInfo) return;
    await navigator.clipboard.writeText(tempPasswordInfo.password);
    toast.success("Senha copiada");
  };

  const filteredUsers = users?.filter(u => 
    (u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.company_name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Gestão de Usuários</CardTitle>
            <CardDescription>Visualize e gerencie todos os usuários da plataforma</CardDescription>
          </div>
          <Button onClick={handleOpenCreate} className="gap-2">
            <UserPlus className="h-4 w-4" /> Novo Usuário
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou empresa..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg bg-destructive/5">
            <UserX className="h-10 w-10 mx-auto mb-4 text-destructive opacity-50" />
            <h3 className="text-lg font-semibold text-destructive mb-2">Falha ao carregar usuários</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              {error instanceof Error ? error.message : "Ocorreu um erro inesperado ao buscar a lista de usuários."}
            </p>
            <Button variant="outline" onClick={() => refetch()} className="gap-2">
              <Loader2 className="h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers?.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{u.full_name || "Sem nome"}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.company_name ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{u.company_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Nenhuma</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.includes("admin") && (
                          <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">Admin Master</Badge>
                        )}
                        {u.membership_role === "owner" && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">Dono</Badge>
                        )}
                        {u.membership_role === "manager" && (
                          <Badge variant="outline">Gerente</Badge>
                        )}
                        {(!u.membership_role || u.membership_role === "member") && !u.roles.includes("admin") && (
                          <Badge variant="outline" className="border">Membro</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.email_confirmed_at ? (
                        <Badge variant="outline" className="text-green-600 flex items-center gap-1 p-0 h-auto">
                          <Check className="h-3 w-3" /> Confirmado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 flex items-center gap-1 p-0 h-auto">
                          <Mail className="h-3 w-3" /> Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "dd/MM HH:mm", { locale: ptBR }) : "Nunca"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleOpenEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" onClick={() => handleOpenSetPassword(u)}>
                          <Lock className="h-4 w-4" />
                        </Button>
                        {u.id !== currentUser?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Isso removerá <strong>{u.full_name || u.email}</strong> permanentemente do sistema e de todas as empresas vinculadas.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteUser(u.id)}>
                                  Confirmar Exclusão
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* User Form Dialog (Create/Edit) */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedUser ? "Editar Usuário" : "Criar Novo Usuário"}</DialogTitle>
            <DialogDescription>
              {selectedUser ? "Altere as informações básicas e vínculos do usuário." : "Cadastre um novo usuário no sistema."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input id="fullName" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} placeholder="João Silva" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="joao@exemplo.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Papel Principal</Label>
                <Select value={formData.role} onValueChange={(v: any) => setFormData({...formData, role: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro comum</SelectItem>
                    <SelectItem value="manager">Gerente (Empresa)</SelectItem>
                    <SelectItem value="owner">Proprietário (Empresa)</SelectItem>
                    <SelectItem value="admin_master">Admin Master (Global)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Empresa Vinculada</Label>
                <Select value={formData.companyId} onValueChange={(v) => setFormData({...formData, companyId: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {companies?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.role === "owner" && !formData.companyId && !selectedUser && (
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome da Nova Empresa</Label>
                <Input id="companyName" value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})} placeholder="Será criada junto com o usuário" />
              </div>
            )}

            {!selectedUser && (
              <div className="space-y-4 border-t pt-4 mt-2">
                <Label>Segurança</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Modo de Senha</Label>
                    <Select value={formData.passwordMode} onValueChange={(v: any) => setFormData({...formData, passwordMode: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Definir manualmente</SelectItem>
                        <SelectItem value="temporary">Gerar temporária automática</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.passwordMode === "manual" && (
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="password">Senha Inicial</Label>
                      <Input id="password" type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Mínimo 6 caracteres" />
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {selectedUser && (
               <div className="space-y-2 border-t pt-4 mt-2">
                 <Label htmlFor="newPassword">Trocar Senha (opcional)</Label>
                 <Input id="newPassword" type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Deixe vazio para manter a atual" />
               </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleFormSubmit} disabled={createUser.isPending || updateUser.isPending}>
              {(createUser.isPending || updateUser.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedUser ? "Salvar Alterações" : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha: {pwdTargetUser?.full_name}</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para o usuário ou gere uma automática.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Modo</Label>
              <Select value={pwdData.passwordMode} onValueChange={(v: any) => setPwdData({...pwdData, passwordMode: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Senha manual</SelectItem>
                  <SelectItem value="temporary">Senha temporária automática</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pwdData.passwordMode === "manual" && (
              <div className="space-y-2">
                <Label htmlFor="manualPwd">Nova Senha</Label>
                <Input id="manualPwd" type="password" value={pwdData.password} onChange={(e) => setPwdData({...pwdData, password: e.target.value})} placeholder="Mínimo 6 caracteres" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSetPassword} disabled={setPassword.isPending}>
              {setPassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Nova Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temporary Password Result Dialog */}
      <Dialog open={!!tempPasswordInfo} onOpenChange={(open) => !open && setTempPasswordInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Senha temporária gerada
            </DialogTitle>
            <DialogDescription>
              Copie e envie a senha abaixo para <strong>{tempPasswordInfo?.email}</strong> por um canal seguro. Por segurança, ela <strong>não será exibida novamente</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={tempPasswordInfo?.password ?? ""} className="font-mono text-lg" />
            <Button type="button" variant="outline" size="icon" onClick={copyPassword}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPasswordInfo(null)}>Fechar e Limpar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
