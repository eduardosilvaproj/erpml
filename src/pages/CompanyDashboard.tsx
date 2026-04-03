import { useState } from "react";
import { useMyCompany, useCompanyMembers, useCompanyAuditLog, useUpdateCompany } from "@/hooks/useCompanyData";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, History, Save, Loader2, Crown, Star } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";

export default function CompanyDashboard() {
  const { user } = useAuth();
  const { data: company, isLoading } = useMyCompany();
  const { data: members } = useCompanyMembers(company?.id);
  const { data: auditLog } = useCompanyAuditLog(company?.id);
  const updateCompany = useUpdateCompany();

  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

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

  const isOwner = company.owner_id === user?.id;

  const roleLabel: Record<string, string> = {
    owner: "Proprietário",
    manager: "Gerente",
    member: "Membro",
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
              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: "name", label: "Nome da Empresa" },
                    { key: "cnpj", label: "CNPJ" },
                    { key: "email", label: "E-mail" },
                    { key: "phone", label: "Telefone" },
                    { key: "address", label: "Endereço" },
                    { key: "city", label: "Cidade" },
                    { key: "state", label: "Estado" },
                    { key: "zip_code", label: "CEP" },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label>{label}</Label>
                      <Input
                        value={form[key] || ""}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
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
            <CardHeader>
              <CardTitle>Membros da Empresa</CardTitle>
              <CardDescription>{members?.length || 0} membro(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Papel</TableHead>
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
                        <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                          {roleLabel[m.role] || m.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.is_active ? "default" : "secondary"}>
                          {m.is_active ? "Ativo" : "Inativo"}
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
            </CardHeader>
            <CardContent>
              {auditLog && auditLog.length > 0 ? (
                <div className="space-y-3">
                  {auditLog.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <History className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{entry.action.replace(/_/g, " ")}</p>
                        {entry.details && (
                          <p className="text-xs text-muted-foreground truncate">
                            {JSON.stringify(entry.details).slice(0, 100)}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhuma alteração registrada.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
