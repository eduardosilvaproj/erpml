import { useState, useMemo } from "react";
import { useAllCompanies, useAllPlans, useToggleCompanyStatus, useUpdatePlan, useAdminUpdateCompany, useAdminChangeCompanyPlan } from "@/hooks/useCompanyData";
import { useIsAdmin } from "@/hooks/useAdminData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Building2, CreditCard, Loader2, Power, PowerOff, Pencil, Users, DollarSign, TrendingUp, PieChart, Settings, Eye, UserPlus, Gift } from "lucide-react";
import PendingUsersTab from "@/components/PendingUsersTab";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from "recharts";
import type { Plan, Company } from "@/hooks/useCompanyData";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(210, 70%, 55%)",
  "hsl(280, 60%, 55%)",
];

type CompanyWithExtras = Company & { plan?: Plan; members_count?: number; owner_profile?: { full_name: string | null } };

export default function MasterAdmin() {
  const { data: isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const { data: companies, isLoading: loadingCompanies } = useAllCompanies();
  const { data: plans, isLoading: loadingPlans } = useAllPlans();
  const toggleStatus = useToggleCompanyStatus();
  const updatePlan = useUpdatePlan();
  const adminUpdateCompany = useAdminUpdateCompany();
  const adminChangePlan = useAdminChangeCompanyPlan();

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState<Partial<Plan>>({});

  // Gestão tab state
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithExtras | null>(null);
  const [gestaoDialog, setGestaoDialog] = useState<"edit" | "plan" | "payment" | null>(null);
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({});
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [courtesyFilter, setCourtesyFilter] = useState<"all" | "courtesy" | "paying">("all");

  // Financial calculations - exclude courtesy companies
  const financialData = useMemo(() => {
    if (!companies || !plans) return null;
    const activeCompanies = companies.filter((c) => c.status === "active" && !c.is_courtesy);
    const revenueByPlan = plans.map((plan) => {
      const companiesOnPlan = activeCompanies.filter((c) => c.plan_id === plan.id);
      return { name: plan.name, empresas: companiesOnPlan.length, receita: companiesOnPlan.length * plan.price, preco: plan.price };
    });
    const mrr = revenueByPlan.reduce((sum, r) => sum + r.receita, 0);
    const arr = mrr * 12;
    const totalActive = activeCompanies.length;
    const avgRevenuePerCompany = totalActive > 0 ? mrr / totalActive : 0;
    const planDistribution = revenueByPlan.filter((r) => r.empresas > 0).map((r) => ({ name: r.name, value: r.empresas }));
    const courtesyCount = companies.filter((c) => c.is_courtesy).length;
    return { revenueByPlan, mrr, arr, totalActive, avgRevenuePerCompany, planDistribution, courtesyCount };
  }, [companies, plans]);

  if (checkingAdmin) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const totalCompanies = companies?.length || 0;
  const activeCompaniesCount = companies?.filter((c) => c.status === "active").length || 0;
  const totalMembers = companies?.reduce((sum, c) => sum + (c.members_count || 0), 0) || 0;

  const handleToggleStatus = async (id: string, current: string) => {
    const newStatus = current === "active" ? "suspended" : "active";
    try {
      await toggleStatus.mutateAsync({ id, status: newStatus });
      toast.success(`Empresa ${newStatus === "active" ? "ativada" : "suspensa"}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanForm({ name: plan.name, price: plan.price, max_users: plan.max_users, max_products: plan.max_products });
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    try {
      await updatePlan.mutateAsync({ id: editingPlan.id, ...planForm } as any);
      toast.success("Plano atualizado!");
      setEditingPlan(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Gestão handlers
  const openEditCompany = (company: CompanyWithExtras) => {
    setSelectedCompany(company);
    setCompanyForm({ name: company.name, cnpj: company.cnpj, email: company.email, phone: company.phone, address: company.address, city: company.city, state: company.state, zip_code: company.zip_code, is_courtesy: company.is_courtesy });
    setGestaoDialog("edit");
  };

  const openChangePlan = (company: CompanyWithExtras) => {
    setSelectedCompany(company);
    setSelectedPlanId(company.plan_id || "");
    setGestaoDialog("plan");
  };

  const openPayment = (company: CompanyWithExtras) => {
    setSelectedCompany(company);
    setGestaoDialog("payment");
  };

  const handleSaveCompany = async () => {
    if (!selectedCompany) return;
    try {
      await adminUpdateCompany.mutateAsync({ id: selectedCompany.id, ...companyForm } as any);
      toast.success("Cadastro atualizado!");
      setGestaoDialog(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleChangePlan = async () => {
    if (!selectedCompany || !selectedPlanId) return;
    try {
      await adminChangePlan.mutateAsync({ companyId: selectedCompany.id, planId: selectedPlanId });
      toast.success("Plano alterado!");
      setGestaoDialog(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      active: { label: "Ativa", variant: "default" },
      suspended: { label: "Suspensa", variant: "destructive" },
      cancelled: { label: "Cancelada", variant: "secondary" },
    };
    const s = map[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Painel Master</h1>
        <p className="text-muted-foreground">Gerencie todas as empresas, planos e finanças da plataforma</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalCompanies}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Ativas</CardTitle>
            <Power className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{activeCompaniesCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalMembers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MRR (Receita Mensal)</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(financialData?.mrr || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="empresas">
        <TabsList className="flex-wrap">
          <TabsTrigger value="empresas"><Building2 className="h-4 w-4 mr-1" /> Empresas</TabsTrigger>
          <TabsTrigger value="pendentes"><UserPlus className="h-4 w-4 mr-1" /> Pendentes</TabsTrigger>
          <TabsTrigger value="gestao"><Settings className="h-4 w-4 mr-1" /> Gestão</TabsTrigger>
          <TabsTrigger value="financeiro"><DollarSign className="h-4 w-4 mr-1" /> Financeiro</TabsTrigger>
          <TabsTrigger value="planos"><CreditCard className="h-4 w-4 mr-1" /> Planos</TabsTrigger>
        </TabsList>

        {/* Empresas Tab */}
        <TabsContent value="empresas">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Todas as Empresas</CardTitle>
                  <CardDescription>{totalCompanies} empresa(s) cadastrada(s){financialData?.courtesyCount ? ` · ${financialData.courtesyCount} cortesia(s)` : ""}</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button variant={courtesyFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setCourtesyFilter("all")}>Todas</Button>
                  <Button variant={courtesyFilter === "paying" ? "default" : "outline"} size="sm" onClick={() => setCourtesyFilter("paying")}>Pagantes</Button>
                  <Button variant={courtesyFilter === "courtesy" ? "default" : "outline"} size="sm" onClick={() => setCourtesyFilter("courtesy")}>
                    <Gift className="h-3 w-3 mr-1" /> Cortesia
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCompanies ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Valor/mês</TableHead>
                        <TableHead>Membros</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criada em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies?.filter((c) => courtesyFilter === "all" ? true : courtesyFilter === "courtesy" ? c.is_courtesy : !c.is_courtesy).map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {c.name}
                              {c.is_courtesy && (
                                <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                                  <Gift className="h-3 w-3 mr-0.5" /> Cortesia
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{c.cnpj || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{c.plan?.name || "—"}</Badge></TableCell>
                          <TableCell>{c.plan ? formatCurrency(c.plan.price) : "—"}</TableCell>
                          <TableCell>{c.members_count}</TableCell>
                          <TableCell>{statusBadge(c.status)}</TableCell>
                          <TableCell>{format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={c.status === "active" ? "destructive" : "default"}
                              size="sm"
                              onClick={() => handleToggleStatus(c.id, c.status)}
                              disabled={toggleStatus.isPending}
                            >
                              {c.status === "active" ? <PowerOff className="h-3 w-3 mr-1" /> : <Power className="h-3 w-3 mr-1" />}
                              {c.status === "active" ? "Suspender" : "Ativar"}
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
        </TabsContent>

        {/* Pendentes Tab */}
        <TabsContent value="pendentes">
          <PendingUsersTab />
        </TabsContent>

        {/* Gestão Tab */}
        <TabsContent value="gestao">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Empresas</CardTitle>
              <CardDescription>Visualize administradores, edite cadastros, configure planos e formas de pagamento</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCompanies ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Admin / Dono</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Plano Atual</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies?.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {c.name}
                              {c.is_courtesy && (
                                <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                                  <Gift className="h-3 w-3 mr-0.5" /> Cortesia
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              {(c as CompanyWithExtras).owner_profile?.full_name || "Sem nome"}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.email || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{c.plan?.name || "—"}</Badge></TableCell>
                          <TableCell>{statusBadge(c.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="outline" size="sm" onClick={() => openEditCompany(c as CompanyWithExtras)} title="Editar cadastro">
                                <Pencil className="h-3 w-3 mr-1" /> Cadastro
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openChangePlan(c as CompanyWithExtras)} title="Configurar plano">
                                <CreditCard className="h-3 w-3 mr-1" /> Plano
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openPayment(c as CompanyWithExtras)} title="Formas de pagamento">
                                <DollarSign className="h-3 w-3 mr-1" /> Pagamento
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
          </Card>
        </TabsContent>

        {/* Financeiro Tab */}
        <TabsContent value="financeiro">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">MRR</CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(financialData?.mrr || 0)}</div>
                  <p className="text-xs text-muted-foreground">Receita Recorrente Mensal</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ARR</CardTitle>
                  <TrendingUp className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(financialData?.arr || 0)}</div>
                  <p className="text-xs text-muted-foreground">Receita Recorrente Anual</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(financialData?.avgRevenuePerCompany || 0)}</div>
                  <p className="text-xs text-muted-foreground">Por empresa ativa</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Empresas Ativas</CardTitle>
                  <Building2 className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{financialData?.totalActive || 0}</div>
                  <p className="text-xs text-muted-foreground">Gerando receita</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Receita por Plano</CardTitle>
                  <CardDescription>MRR detalhado por tipo de plano</CardDescription>
                </CardHeader>
                <CardContent>
                  {financialData && financialData.revenueByPlan.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={financialData.revenueByPlan}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-xs fill-muted-foreground" />
                        <YAxis className="text-xs fill-muted-foreground" tickFormatter={(v) => `R$${v}`} />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), "Receita"]}
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição de Empresas</CardTitle>
                  <CardDescription>Empresas ativas por plano</CardDescription>
                </CardHeader>
                <CardContent>
                  {financialData && financialData.planDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <RechartsPie>
                        <Pie data={financialData.planDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {financialData.planDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">Nenhuma empresa ativa</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detalhamento de Receita</CardTitle>
                <CardDescription>Receita por plano com quantidade de empresas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plano</TableHead>
                        <TableHead>Preço Unitário</TableHead>
                        <TableHead>Empresas Ativas</TableHead>
                        <TableHead>Receita Mensal</TableHead>
                        <TableHead>Receita Anual</TableHead>
                        <TableHead>% do MRR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {financialData?.revenueByPlan.map((r) => (
                        <TableRow key={r.name}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>{formatCurrency(r.preco)}</TableCell>
                          <TableCell>{r.empresas}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(r.receita)}</TableCell>
                          <TableCell>{formatCurrency(r.receita * 12)}</TableCell>
                          <TableCell>
                            {financialData.mrr > 0 ? `${((r.receita / financialData.mrr) * 100).toFixed(1)}%` : "0%"}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>Total</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>{financialData?.totalActive || 0}</TableCell>
                        <TableCell>{formatCurrency(financialData?.mrr || 0)}</TableCell>
                        <TableCell>{formatCurrency(financialData?.arr || 0)}</TableCell>
                        <TableCell>100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Planos Tab */}
        <TabsContent value="planos">
          <Card>
            <CardHeader>
              <CardTitle>Planos de Assinatura</CardTitle>
              <CardDescription>Gerencie os planos disponíveis</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPlans ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plano</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Máx. Usuários</TableHead>
                        <TableHead>Máx. Produtos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans?.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{formatCurrency(p.price)}</TableCell>
                          <TableCell>{p.max_users}</TableCell>
                          <TableCell>{p.max_products >= 99999 ? "∞" : p.max_products}</TableCell>
                          <TableCell>
                            <Badge variant={p.is_active ? "default" : "secondary"}>
                              {p.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => openEditPlan(p)}>
                              <Pencil className="h-3 w-3 mr-1" /> Editar
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
        </TabsContent>
      </Tabs>

      {/* Edit Plan Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={() => setEditingPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Plano: {editingPlan?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={planForm.name || ""} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" value={planForm.price ?? 0} onChange={(e) => setPlanForm({ ...planForm, price: parseFloat(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Máx. Usuários</Label>
                <Input type="number" value={planForm.max_users ?? 1} onChange={(e) => setPlanForm({ ...planForm, max_users: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Máx. Produtos</Label>
                <Input type="number" value={planForm.max_products ?? 50} onChange={(e) => setPlanForm({ ...planForm, max_products: parseInt(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>Cancelar</Button>
            <Button onClick={handleSavePlan} disabled={updatePlan.isPending}>
              {updatePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Registration Dialog */}
      <Dialog open={gestaoDialog === "edit"} onOpenChange={() => setGestaoDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Cadastro: {selectedCompany?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nome da Empresa</Label>
              <Input value={companyForm.name || ""} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>CNPJ</Label>
              <Input value={companyForm.cnpj || ""} onChange={(e) => setCompanyForm({ ...companyForm, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input value={companyForm.email || ""} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={companyForm.phone || ""} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Endereço</Label>
              <Input value={companyForm.address || ""} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Cidade</Label>
                <Input value={companyForm.city || ""} onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Input value={companyForm.state || ""} onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })} maxLength={2} />
              </div>
              <div className="space-y-1">
                <Label>CEP</Label>
                <Input value={companyForm.zip_code || ""} onChange={(e) => setCompanyForm({ ...companyForm, zip_code: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-amber-500" /> Cortesia
                </Label>
                <p className="text-xs text-muted-foreground">Empresa cortesia não é contabilizada nos relatórios de receita</p>
              </div>
              <Switch
                checked={!!companyForm.is_courtesy}
                onCheckedChange={(checked) => setCompanyForm({ ...companyForm, is_courtesy: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGestaoDialog(null)}>Cancelar</Button>
            <Button onClick={handleSaveCompany} disabled={adminUpdateCompany.isPending}>
              {adminUpdateCompany.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={gestaoDialog === "plan"} onOpenChange={() => setGestaoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Plano: {selectedCompany?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Plano atual</Label>
              <p className="text-sm text-muted-foreground">{selectedCompany?.plan?.name || "Nenhum"} — {selectedCompany?.plan ? formatCurrency(selectedCompany.plan.price) + "/mês" : ""}</p>
            </div>
            <div className="space-y-1">
              <Label>Novo Plano</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.price)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGestaoDialog(null)}>Cancelar</Button>
            <Button onClick={handleChangePlan} disabled={adminChangePlan.isPending || selectedPlanId === selectedCompany?.plan_id}>
              {adminChangePlan.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Alterar Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Methods Dialog */}
      <Dialog open={gestaoDialog === "payment"} onOpenChange={() => setGestaoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Formas de Pagamento: {selectedCompany?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Boleto Bancário</span>
                    </div>
                    <Badge variant="outline">Disponível</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Cartão de Crédito</span>
                    </div>
                    <Badge variant="outline">Disponível</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">PIX</span>
                    </div>
                    <Badge variant="default">Ativo</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="rounded-lg border border-border p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground">
                <strong>Plano:</strong> {selectedCompany?.plan?.name || "Nenhum"}<br />
                <strong>Valor:</strong> {selectedCompany?.plan ? formatCurrency(selectedCompany.plan.price) + "/mês" : "—"}<br />
                <strong>Status:</strong> {selectedCompany?.status === "active" ? "Em dia" : "Pendente"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGestaoDialog(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
