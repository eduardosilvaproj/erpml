import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Search, Loader2, Building2, Eye, Pencil, Plus, UserPlus, CreditCard, Power, PowerOff, Gift, Beaker, MapPin, Mail, Phone, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useGovernanceCompanies, useAdminCreateCompany, useAdminAssignOwner } from "@/hooks/useGovernanceActions";
import { useAllPlans, useToggleCompanyStatus, useAdminUpdateCompany, useAdminChangeCompanyPlan, Company } from "@/hooks/useCompanyData";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export const CompaniesPanel = () => {
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [dialog, setDialog] = useState<"details" | "edit" | "new" | "plan" | "owner" | null>(null);
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({});
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  const queryClient = useQueryClient();
  const { data: companies, isLoading, error, refetch } = useGovernanceCompanies(search);
  const { data: plans } = useAllPlans();

  const createMutation = useAdminCreateCompany();
  const updateMutation = useAdminUpdateCompany();
  const planMutation = useAdminChangeCompanyPlan();
  const statusMutation = useToggleCompanyStatus();
  const ownerMutation = useAdminAssignOwner();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500">Ativa</Badge>;
      case "suspended": return <Badge variant="destructive">Suspensa</Badge>;
      case "cancelled": return <Badge variant="secondary">Cancelada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCreate = async () => {
    if (!companyForm.name) return toast.error("Nome é obrigatório");
    await createMutation.mutateAsync(companyForm);
    setDialog(null);
    setCompanyForm({});
  };

  const handleUpdate = async () => {
    if (!selectedCompany) return;
    await updateMutation.mutateAsync({ id: selectedCompany.id, ...companyForm });
    setDialog(null);
  };

  const handleChangePlan = async () => {
    if (!selectedCompany || !selectedPlanId) return;
    await planMutation.mutateAsync({ companyId: selectedCompany.id, planId: selectedPlanId });
    setDialog(null);
  };

  const handleToggleStatus = async (company: any) => {
    const newStatus = company.status === "active" ? "suspended" : "active";
    await statusMutation.mutateAsync({ id: company.id, status: newStatus });
    toast.success(`Empresa ${newStatus === 'active' ? 'ativada' : 'suspensa'} com sucesso`);
  };

  const handleAssignOwner = async () => {
    if (!selectedCompany || !selectedOwnerId) return;
    await ownerMutation.mutateAsync({ companyId: selectedCompany.id, userId: selectedOwnerId });
    setDialog(null);
  };

  const openOwnerDialog = async (company: any) => {
    setSelectedCompany(company);
    setSelectedOwnerId(company.owner_id || "");
    setDialog("owner");
    setLoadingProfiles(true);
    try {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      setProfiles(data || []);
    } catch (e) {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoadingProfiles(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Empresas Cadastradas</CardTitle>
            <CardDescription>Gestão cadastral e organizacional das empresas</CardDescription>
          </div>
          <Button onClick={() => { setCompanyForm({ status: 'active', is_courtesy: false }); setDialog("new"); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Empresa
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CNPJ..."
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
            <Building2 className="h-10 w-10 mx-auto mb-4 text-destructive opacity-50" />
            <h3 className="text-lg font-semibold text-destructive mb-2">Falha ao carregar empresas</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              {error instanceof Error ? error.message : "Ocorreu um erro inesperado ao carregar as empresas."}
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
                  <TableHead>Empresa</TableHead>
                  <TableHead>Dono / Admin</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies?.map((company: any) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2">
                          {company.name}
                          {company.is_courtesy && <Badge variant="outline" className="text-[10px] h-4 border-amber-500 text-amber-600">Cortesia</Badge>}
                          {company.is_test && <Badge variant="outline" className="text-[10px] h-4 border-blue-500 text-blue-600">Teste</Badge>}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">{company.id.substring(0, 8)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.owner_profile ? (
                        <div className="flex flex-col">
                          <span className="text-sm">{company.owner_profile.full_name}</span>
                          <span className="text-[10px] text-muted-foreground">{company.owner_profile.email}</span>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-600 p-0" onClick={() => openOwnerDialog(company)}>
                          <UserPlus className="h-3 w-3 mr-1" /> Atribuir
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{company.cnpj || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={company.plan?.slug === 'enterprise' ? "border-amber-500 text-amber-600" : ""}>
                        {company.plan?.name || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(company.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedCompany(company); setDialog("details"); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => { setSelectedCompany(company); setSelectedPlanId(company.plan_id || ""); setDialog("plan"); }}>
                          <CreditCard className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedCompany(company); setCompanyForm(company); setDialog("edit"); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 ${company.status === 'active' ? 'text-orange-600' : 'text-green-600'}`}
                          onClick={() => handleToggleStatus(company)}
                          disabled={statusMutation.isPending}
                        >
                          {company.status === 'active' ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Details Dialog */}
      <Dialog open={dialog === "details"} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Detalhes: {selectedCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase">Status</Label>
                  <div>{selectedCompany && getStatusBadge(selectedCompany.status)}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase">Plano</Label>
                  <div>
                    <Badge variant="outline" className="font-semibold text-primary">
                      {selectedCompany?.plan?.name || "Sem plano"}
                    </Badge>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" /> Localização</h4>
                  <p className="text-sm">{selectedCompany?.address || "Não informado"}</p>
                  <p className="text-sm">{selectedCompany?.city && `${selectedCompany.city}, `}{selectedCompany?.state} {selectedCompany?.zip_code}</p>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Mail className="h-4 w-4" /> Contato</h4>
                  <div className="flex items-center gap-2 text-sm"><Mail className="h-3 w-3 text-muted-foreground" /> {selectedCompany?.email || "—"}</div>
                  <div className="flex items-center gap-2 text-sm"><Phone className="h-3 w-3 text-muted-foreground" /> {selectedCompany?.phone || "—"}</div>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Dados de Sistema</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div><span className="text-muted-foreground">ID:</span> <span className="font-mono">{selectedCompany?.id}</span></div>
                  <div><span className="text-muted-foreground">Criada em:</span> {selectedCompany?.created_at && format(new Date(selectedCompany.created_at), "PPP", { locale: ptBR })}</div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Plan Dialog */}
      <Dialog open={dialog === "plan"} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Plano: {selectedCompany?.name}</DialogTitle>
            <DialogDescription>Mude o plano da empresa. Planos Enterprise liberam todos os recursos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selecione o Novo Plano</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - {p.price === 0 ? "Grátis" : `R$ ${p.price.toFixed(2)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCompany?.is_test && (
              <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                <p className="text-xs text-blue-800 flex items-center gap-2">
                  <Beaker className="h-4 w-4" /> Esta é uma empresa de teste. Alterar para um plano oficial (como Enterprise) removerá restrições.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleChangePlan} disabled={planMutation.isPending || !selectedPlanId} className="bg-blue-600 hover:bg-blue-700">
              {planMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Owner Dialog */}
      <Dialog open={dialog === "owner"} onOpenChange={() => setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Dono: {selectedCompany?.name}</DialogTitle>
            <DialogDescription>Selecione um usuário para ser o responsável principal desta empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Usuário Responsável</Label>
              <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingProfiles ? "Carregando usuários..." : "Selecione um usuário"} />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[200px]">
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || "Sem nome"} ({p.email})
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleAssignOwner} disabled={ownerMutation.isPending || !selectedOwnerId}>
              {ownerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Atribuição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/New Dialog */}
      <Dialog open={dialog === "edit" || dialog === "new"} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialog === "new" ? "Nova Empresa" : `Editar: ${selectedCompany?.name}`}</DialogTitle>
            <DialogDescription>{dialog === "new" ? "Cadastre uma nova empresa administrativamente." : "Atualize os dados da empresa."}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <Label>Nome da Empresa</Label>
                  <Input value={companyForm.name || ""} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="Ex: Stovix LTDA" />
                </div>
                <div className="space-y-1">
                  <Label>CNPJ</Label>
                  <Input value={companyForm.cnpj || ""} onChange={(e) => setCompanyForm({ ...companyForm, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>E-mail de Contato</Label>
                    <Input value={companyForm.email || ""} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} placeholder="admin@empresa.com" />
                  </div>
                  <div className="space-y-1">
                    <Label>Telefone</Label>
                    <Input value={companyForm.phone || ""} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                {dialog === "new" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Plano Inicial</Label>
                      <Select value={companyForm.plan_id || ""} onValueChange={(v) => setCompanyForm({ ...companyForm, plan_id: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um plano" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Status Inicial</Label>
                      <Select value={companyForm.status || "active"} onValueChange={(v) => setCompanyForm({ ...companyForm, status: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativa</SelectItem>
                          <SelectItem value="suspended">Suspensa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Endereço</Label>
                  <Input value={companyForm.address || ""} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1"><Label>Cidade</Label><Input value={companyForm.city || ""} onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })} /></div>
                  <div className="space-y-1"><Label>UF</Label><Input value={companyForm.state || ""} onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })} maxLength={2} /></div>
                  <div className="space-y-1"><Label>CEP</Label><Input value={companyForm.zip_code || ""} onChange={(e) => setCompanyForm({ ...companyForm, zip_code: e.target.value })} /></div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2"><Gift className="h-4 w-4 text-amber-500" /> Cortesia</Label>
                    <p className="text-[10px] text-muted-foreground">Empresas cortesia não geram faturamento no painel.</p>
                  </div>
                  <Switch checked={!!companyForm.is_courtesy} onCheckedChange={(v) => setCompanyForm({ ...companyForm, is_courtesy: v })} />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={dialog === "new" ? handleCreate : handleUpdate} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialog === "new" ? "Criar Empresa" : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
