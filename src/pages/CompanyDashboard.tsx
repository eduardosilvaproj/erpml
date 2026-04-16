import { useState, useRef } from "react";
import { useMyCompany, useCompanyMembers, useCompanyAuditLog, useUpdateCompany } from "@/hooks/useCompanyData";
import { maskCnpj, maskPhone, maskCep } from "@/lib/masks";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, History, Save, Loader2, Crown, Star, Camera, UserPlus, Mail } from "lucide-react";
import { APP_VERSION } from "@/config/version";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

function CompanyLogoUpload({ companyId, logoUrl, isOwner }: { companyId: string; logoUrl: string | null; isOwner: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const publicLogoUrl = logoUrl
    ? logoUrl.startsWith("http") ? logoUrl : supabase.storage.from("avatars").getPublicUrl(logoUrl).data?.publicUrl
    : null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Máximo 2MB"); return; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `company-logos/${companyId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("companies").update({ logo_url: path } as any).eq("id", companyId);
      if (dbErr) throw dbErr;
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
      toast.success("Logo atualizado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar logo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 mb-6">
      <div
        className={`relative w-[120px] h-[120px] rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden ${isOwner ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}`}
        onClick={() => isOwner && fileRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : publicLogoUrl ? (
          <img src={publicLogoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Camera className="h-8 w-8" />
            <span className="text-xs text-center">Logo da empresa</span>
          </div>
        )}
      </div>
      {isOwner && (
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} disabled={uploading} />
      )}
      <p className="text-xs text-muted-foreground">Recomendado: 200×200px</p>
    </div>
  );
}

export default function CompanyDashboard() {
  const { user } = useAuth();
  const { data: company, isLoading } = useMyCompany();
  const { data: members } = useCompanyMembers(company?.id);
  const { data: auditLog } = useCompanyAuditLog(company?.id);
  const updateCompany = useUpdateCompany();

  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return <Navigate to="/onboarding" replace />;
  }

  const handleEdit = () => {
    setForm({
      name: company.name || "",
      cnpj: company.cnpj || "",
      email: company.email || "",
      phone: company.phone || "",
      address: company.address || "",
      city: company.city || "",
      state: company.state || "",
      zip_code: company.zip_code || "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateCompany.mutateAsync({ id: company.id, ...form } as any);
      toast.success("Empresa atualizada com sucesso!");
      setEditing(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error("Informe o e-mail"); return; }
    setInviting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-member`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ email: inviteEmail, role: inviteRole, companyId: company.id }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao convidar");
      }
      toast.success("Convite enviado!");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("member");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setInviting(false);
    }
  };

  const isOwner = company.owner_id === user?.id;

  const roleLabel: Record<string, string> = {
    owner: "Admin",
    manager: "Gerente",
    member: "Operador",
  };

  const statusColor: Record<string, string> = {
    active: "bg-accent text-accent-foreground",
    suspended: "bg-destructive text-destructive-foreground",
    cancelled: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Minha Empresa</h1>
          <p className="text-muted-foreground">Gerencie os dados cadastrais da sua empresa</p>
        </div>
        <Badge className={statusColor[company.status] || ""}>
          {company.status === "active" ? "Ativa" : company.status === "suspended" ? "Suspensa" : "Cancelada"}
        </Badge>
      </div>

      {/* Plan card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-lg">Plano Atual</CardTitle>
            <CardDescription>
              {company.plan?.name || "Sem plano"} — R$ {company.plan?.price?.toFixed(2) || "0,00"}/mês
            </CardDescription>
          </div>
          <Star className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {company.plan?.features?.map((f, i) => (
              <Badge key={i} variant="outline">{f}</Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {company.members_count}/{company.plan?.max_users || 1} usuários • {company.plan?.max_products || 50} produtos máx.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados"><Building2 className="h-4 w-4 mr-1" /> Dados</TabsTrigger>
          <TabsTrigger value="membros"><Users className="h-4 w-4 mr-1" /> Membros</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-4 w-4 mr-1" /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Dados Cadastrais</CardTitle>
              {isOwner && !editing && (
                <Button variant="outline" size="sm" onClick={handleEdit}>Editar</Button>
              )}
            </CardHeader>
            <CardContent>
              <CompanyLogoUpload companyId={company.id} logoUrl={(company as any).logo_url} isOwner={isOwner} />
              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: "name", label: "Nome da Empresa", mask: null },
                    { key: "cnpj", label: "CNPJ", mask: "cnpj" },
                    { key: "email", label: "E-mail", mask: null },
                    { key: "phone", label: "Telefone", mask: "phone" },
                    { key: "address", label: "Endereço", mask: null },
                    { key: "city", label: "Cidade", mask: null },
                    { key: "state", label: "Estado", mask: null },
                    { key: "zip_code", label: "CEP", mask: "cep" },
                  ].map(({ key, label, mask }) => (
                    <div key={key} className="space-y-1">
                      <Label>{label}</Label>
                      <Input
                        value={form[key] || ""}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (mask === "cnpj") val = maskCnpj(val);
                          if (mask === "phone") val = maskPhone(val);
                          if (mask === "cep") val = maskCep(val);
                          setForm({ ...form, [key]: val });
                        }}
                        maxLength={mask === "cnpj" ? 18 : mask === "phone" ? 15 : mask === "cep" ? 9 : undefined}
                      />
                    </div>
                  ))}
                  <div className="col-span-full flex gap-2">
                    <Button onClick={handleSave} disabled={updateCompany.isPending}>
                      {updateCompany.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                      Salvar
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: "Nome", value: company.name },
                    { label: "CNPJ", value: company.cnpj },
                    { label: "E-mail", value: company.email },
                    { label: "Telefone", value: company.phone },
                    { label: "Endereço", value: company.address },
                    { label: "Cidade", value: company.city },
                    { label: "Estado", value: company.state },
                    { label: "CEP", value: company.zip_code },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-sm font-medium text-muted-foreground">{label}</p>
                      <p className="text-foreground">{value || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="membros">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Membros da Empresa</CardTitle>
                <CardDescription>{members?.length || 0} membro(s)</CardDescription>
              </div>
              {isOwner && (
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Convidar membro
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Nível de Acesso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Desde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members?.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {m.role === "owner" && <Crown className="h-4 w-4 text-primary" />}
                          {m.profile?.full_name || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {(m.profile as any)?.email || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                          {roleLabel[m.role] || m.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.is_active ? "default" : "outline"} className={m.is_active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}>
                          {m.is_active ? "Ativo" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(m.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Alterações</CardTitle>
              <CardDescription>Últimas 50 ações registradas</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLog && auditLog.length > 0 ? (
                <div className="space-y-3">
                  {auditLog.map((entry) => {
                    const actionLabels: Record<string, string> = {
                      company_created: "Empresa criada",
                      company_updated: "Dados da empresa atualizados",
                      member_invited: "Membro convidado",
                      member_removed: "Membro removido",
                      member_role_changed: "Papel de membro alterado",
                    };
                    return (
                      <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border">
                        <History className="h-4 w-4 mt-1 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {actionLabels[entry.action] || entry.action.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            por {(entry as any).user_name || "Usuário"}
                          </p>
                          {entry.details && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {entry.action === "member_invited" && `E-mail: ${(entry.details as any).email}`}
                              {entry.action === "member_role_changed" && `${(entry.details as any).old_role} → ${(entry.details as any).new_role}`}
                              {!["member_invited", "member_role_changed", "member_removed"].includes(entry.action) &&
                                JSON.stringify(entry.details).slice(0, 100)}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhuma alteração registrada.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite member dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>E-mail *</Label>
              <Input placeholder="email@exemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nível de Acesso</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="member">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-8 text-center">
        <p className="text-[11px] text-muted-foreground/50 select-none">
          Versão {APP_VERSION} — Atualizado em {new Date().toLocaleDateString("pt-BR")}
        </p>
      </div>
    </div>
  );
}


