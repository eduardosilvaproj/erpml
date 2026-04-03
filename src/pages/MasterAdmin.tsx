import { useState, useMemo } from "react";
import { useAllCompanies, useAllPlans, useToggleCompanyStatus, useUpdatePlan } from "@/hooks/useCompanyData";
import { useIsAdmin } from "@/hooks/useAdminData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Building2, CreditCard, Loader2, Power, PowerOff, Pencil, Users, DollarSign, TrendingUp, PieChart } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from "recharts";
import type { Plan } from "@/hooks/useCompanyData";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(210, 70%, 55%)",
  "hsl(280, 60%, 55%)",
];

export default function MasterAdmin() {
  const { data: isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const { data: companies, isLoading: loadingCompanies } = useAllCompanies();
  const { data: plans, isLoading: loadingPlans } = useAllPlans();
  const toggleStatus = useToggleCompanyStatus();
  const updatePlan = useUpdatePlan();

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState<Partial<Plan>>({});

  // Financial calculations
  const financialData = useMemo(() => {
    if (!companies || !plans) return null;

    const activeCompanies = companies.filter((c) => c.status === "active");

    // Revenue by plan
    const revenueByPlan = plans.map((plan) => {
      const companiesOnPlan = activeCompanies.filter((c) => c.plan_id === plan.id);
      return {
        name: plan.name,
        empresas: companiesOnPlan.length,
        receita: companiesOnPlan.length * plan.price,
        preco: plan.price,
      };
    });

    const mrr = revenueByPlan.reduce((sum, r) => sum + r.receita, 0);
    const arr = mrr * 12;
    const totalActive = activeCompanies.length;
    const avgRevenuePerCompany = totalActive > 0 ? mrr / totalActive : 0;

    // Pie chart data for distribution
    const planDistribution = revenueByPlan
      .filter((r) => r.empresas > 0)
      .map((r) => ({
        name: r.name,
        value: r.empresas,
      }));

    return { revenueByPlan, mrr, arr, totalActive, avgRevenuePerCompany, planDistribution };
  }, [companies, plans]);

  if (checkingAdmin) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const totalCompanies = companies?.length || 0;
  const activeCompanies = companies?.filter((c) => c.status === "active").length || 0;
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
          <CardContent><div className="text-2xl font-bold">{activeCompanies}</div></CardContent>
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
        <TabsList>
          <TabsTrigger value="empresas"><Building2 className="h-4 w-4 mr-1" /> Empresas</TabsTrigger>
          <TabsTrigger value="financeiro"><DollarSign className="h-4 w-4 mr-1" /> Financeiro</TabsTrigger>
          <TabsTrigger value="planos"><CreditCard className="h-4 w-4 mr-1" /> Planos</TabsTrigger>
        </TabsList>

        {/* Empresas Tab */}
        <TabsContent value="empresas">
          <Card>
            <CardHeader>
              <CardTitle>Todas as Empresas</CardTitle>
              <CardDescription>{totalCompanies} empresa(s) cadastrada(s)</CardDescription>
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
                      {companies?.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
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

        {/* Financeiro Tab */}
        <TabsContent value="financeiro">
          <div className="space-y-6">
            {/* Financial KPIs */}
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

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by Plan Bar Chart */}
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

              {/* Plan Distribution Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição de Empresas</CardTitle>
                  <CardDescription>Empresas ativas por plano</CardDescription>
                </CardHeader>
                <CardContent>
                  {financialData && financialData.planDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <RechartsPie>
                        <Pie
                          data={financialData.planDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
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

            {/* Revenue Detail Table */}
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
                            {financialData.mrr > 0
                              ? `${((r.receita / financialData.mrr) * 100).toFixed(1)}%`
                              : "0%"}
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
    </div>
  );
}
