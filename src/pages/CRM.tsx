import { useState, Fragment, useMemo } from "react";
import {
  Users, Plus, Search, ShoppingBag, Pencil, Trash2, Loader2, MessageSquare,
  Phone, Mail, Eye, ArrowLeft, Filter, ArrowUpDown, Calendar, MapPin, FileText,
  DollarSign, TrendingUp, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  useCustomers, useCustomerStats, useCreateCustomer, useUpdateCustomer,
  useDeleteCustomer, useCustomerWithPurchases, type Customer
} from "@/hooks/useCustomerData";
import MLQuestionsTab from "@/components/MLQuestionsTab";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCompanyId } from "@/hooks/useCompanyId";

// Avatar colors based on name hash
const AVATAR_COLORS = [
  "bg-primary/20 text-primary",
  "bg-emerald-500/20 text-emerald-400",
  "bg-amber-500/20 text-amber-400",
  "bg-rose-500/20 text-rose-400",
  "bg-violet-500/20 text-violet-400",
  "bg-sky-500/20 text-sky-400",
  "bg-orange-500/20 text-orange-400",
  "bg-pink-500/20 text-pink-400",
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

function maskCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

type FilterType = "all" | "active" | "no_purchases";
type SortType = "name" | "most_purchases" | "most_recent";


// Hook for customer purchase totals
function useCustomerPurchaseTotals() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["customer-purchase-totals", companyId],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("customer_id, total_value, created_at")
        .not("customer_id", "is", null);
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
      if (error) throw error;

      const totals: Record<string, { total: number; count: number; lastDate: string }> = {};
      for (const sale of data || []) {
        if (!sale.customer_id) continue;
        if (!totals[sale.customer_id]) {
          totals[sale.customer_id] = { total: 0, count: 0, lastDate: sale.created_at };
        }
        totals[sale.customer_id].total += sale.total_value;
        totals[sale.customer_id].count += 1;
        if (sale.created_at > totals[sale.customer_id].lastDate) {
          totals[sale.customer_id].lastDate = sale.created_at;
        }
      }
      return totals;
    },
  });
}

const CRM = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("name");
  const [docType, setDocType] = useState<"cpf" | "cnpj">("cpf");
  const [form, setForm] = useState({
    name: "", phone: "", email: "", cpf: "", address: "", notes: "", birthday: ""
  });

  const { data: customers, isLoading } = useCustomers(search || undefined);
  const { data: stats } = useCustomerStats();
  const { data: purchases } = useCustomerWithPurchases(profileCustomer?.id || selectedCustomerId);
  const { data: purchaseTotals } = useCustomerPurchaseTotals();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const openNew = () => {
    setEditing(null);
    setDocType("cpf");
    setForm({ name: "", phone: "", email: "", cpf: "", address: "", notes: "", birthday: "" });
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    const digits = (c.cpf || "").replace(/\D/g, "");
    setDocType(digits.length > 11 ? "cnpj" : "cpf");
    setForm({
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      cpf: c.cpf || "",
      address: c.address || "",
      notes: c.notes || "",
      birthday: "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      cpf: form.cpf || undefined,
      address: form.address || undefined,
      notes: form.notes || undefined,
    };
    if (editing) {
      await updateCustomer.mutateAsync({ id: editing.id, data: payload });
    } else {
      await createCustomer.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // Filtered and sorted customers
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    let result = [...customers];

    // Filter
    if (filterType === "active") {
      result = result.filter((c) => purchaseTotals?.[c.id]?.count > 0);
    } else if (filterType === "no_purchases") {
      result = result.filter((c) => !purchaseTotals?.[c.id]?.count);
    }

    // Sort
    if (sortType === "most_purchases") {
      result.sort((a, b) => (purchaseTotals?.[b.id]?.total || 0) - (purchaseTotals?.[a.id]?.total || 0));
    } else if (sortType === "most_recent") {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [customers, filterType, sortType, purchaseTotals]);

  const getCustomerTotals = (id: string) => {
    if (MOCK_PURCHASE_TOTALS[id]) return MOCK_PURCHASE_TOTALS[id];
    return purchaseTotals?.[id] || { total: 0, count: 0, lastDate: "" };
  };

  // Merge mock customer into list
  const allCustomers = useMemo(() => {
    const real = filteredCustomers || [];
    const hasMock = real.some((c) => c.id === MOCK_CUSTOMER.id);
    if (hasMock) return real;
    return [MOCK_CUSTOMER, ...real];
  }, [filteredCustomers]);

  // Use mock purchases when viewing mock customer
  const displayPurchases = profileCustomer?.id === "mock-maria-silva" ? MOCK_PURCHASES : purchases;

  // ===== PROFILE VIEW =====
  if (profileCustomer) {
    const totals = getCustomerTotals(profileCustomer.id);
    const ticketMedio = totals.count > 0 ? totals.total / totals.count : 0;

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setProfileCustomer(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Perfil do Cliente</h1>
            <p className="text-sm text-muted-foreground">{profileCustomer.name}</p>
          </div>
          <div className="ml-auto">
            <Button variant="outline" onClick={() => { openEdit(profileCustomer); }}>
              <Pencil className="h-4 w-4 mr-2" /> Editar cliente
            </Button>
          </div>
        </div>

        {/* Customer Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold ${getAvatarColor(profileCustomer.name)}`}>
                {getInitials(profileCustomer.name)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{profileCustomer.name}</h2>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                  {profileCustomer.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {formatPhone(profileCustomer.phone)}
                    </span>
                  )}
                  {profileCustomer.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {profileCustomer.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-3 grid-cols-2 text-sm">
              {profileCustomer.cpf && (
                <div><span className="text-muted-foreground">CPF/CNPJ:</span> <span className="font-mono">{profileCustomer.cpf}</span></div>
              )}
              {profileCustomer.address && (
                <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" /> {profileCustomer.address}</div>
              )}
              {profileCustomer.notes && (
                <div className="col-span-2"><span className="text-muted-foreground">Obs:</span> {profileCustomer.notes}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[
            { label: "Total Gasto", value: formatCurrency(totals.total), icon: DollarSign, color: "text-emerald-400 bg-emerald-500/10" },
            { label: "Nº Compras", value: String(totals.count), icon: ShoppingBag, color: "text-primary bg-primary/10" },
            { label: "Ticket Médio", value: formatCurrency(ticketMedio), icon: TrendingUp, color: "text-amber-400 bg-amber-500/10" },
            { label: "Última Compra", value: totals.lastDate ? new Date(totals.lastDate).toLocaleDateString("pt-BR") : "—", icon: Clock, color: "text-sky-400 bg-sky-500/10" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`rounded-lg p-2 ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Purchase History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de Compras</CardTitle>
          </CardHeader>
          <CardContent>
              {displayPurchases && displayPurchases.length > 0 ? (
              <div className="space-y-3">
                {displayPurchases.map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between rounded-xl bg-muted/30 p-4 border border-border/40">
                    <div>
                      <p className="font-medium text-sm">{sale.sale_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(sale.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        {" • "}{sale.sale_items?.length || 0} item(s)
                        {" • "}<Badge variant="outline" className="text-[10px] px-1.5">{sale.payment_method}</Badge>
                      </p>
                      {sale.sale_items?.map((item: any) => (
                        <p key={item.id} className="text-xs text-muted-foreground mt-1">
                          {item.quantity}x {item.product_name}
                        </p>
                      ))}
                    </div>
                    <p className="font-bold text-foreground">{formatCurrency(sale.total_value)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma compra registrada</p>
            )}
          </CardContent>
        </Card>

        {/* Dialog still available for editing from profile */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            {renderForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.name.trim() || createCustomer.isPending || updateCustomer.isPending}>
                {(createCustomer.isPending || updateCustomer.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  function renderForm() {
    return (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <div>
          <Label>Nome completo *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do cliente" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Label className="mb-0">{docType === "cpf" ? "CPF" : "CNPJ"}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => {
                setDocType(docType === "cpf" ? "cnpj" : "cpf");
                setForm({ ...form, cpf: "" });
              }}
            >
              Alternar para {docType === "cpf" ? "CNPJ" : "CPF"}
            </Button>
          </div>
          <Input
            value={form.cpf}
            onChange={(e) => setForm({ ...form, cpf: maskCpfCnpj(e.target.value) })}
            placeholder={docType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
            maxLength={docType === "cpf" ? 14 : 18}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Telefone *</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
              placeholder="(00) 00000-0000"
              maxLength={15}
            />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
          </div>
        </div>
        <div>
          <Label>Endereço</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, nº, bairro, cidade - UF" />
        </div>
        <div>
          <Label>Data de Aniversário</Label>
          <Input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas sobre o cliente..."
            rows={3}
          />
        </div>
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM - Clientes</h1>
          <p className="text-muted-foreground">Gerencie clientes, histórico de compras e perguntas ML</p>
        </div>
      </div>

      <Tabs defaultValue="clientes">
        <TabsList>
          <TabsTrigger value="clientes">
            <Users className="mr-2 h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="perguntas-ml">
            <MessageSquare className="mr-2 h-4 w-4" />
            Perguntas ML
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Total Clientes", value: stats?.total ?? 0, icon: Users },
              { label: "Compras (30d)", value: stats?.purchases30d ?? 0, icon: ShoppingBag },
              { label: "Novos (30d)", value: stats?.new30d ?? 0, icon: Plus },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente por nome, telefone ou email..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
                    <SelectTrigger className="w-[140px]">
                      <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="no_purchases">Sem compras</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortType} onValueChange={(v) => setSortType(v as SortType)}>
                    <SelectTrigger className="w-[160px]">
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Nome</SelectItem>
                      <SelectItem value="most_purchases">Mais compras</SelectItem>
                      <SelectItem value="most_recent">Mais recente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : allCustomers.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Total Compras</TableHead>
                        <TableHead>Última Compra</TableHead>
                        <TableHead className="w-[120px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allCustomers.map((c) => {
                        const totals = getCustomerTotals(c.id);
                        return (
                          <TableRow key={c.id} className="hover:bg-muted/30">
                            <TableCell>
                              <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${getAvatarColor(c.name)}`}>
                                {getInitials(c.name)}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell>
                              {c.phone ? (
                                <a
                                  href={`https://wa.me/55${c.phone.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Abrir WhatsApp"
                                >
                                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                  {formatPhone(c.phone)}
                                </a>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{c.email || "—"}</TableCell>
                            <TableCell className="text-right font-medium">
                              {totals.total > 0 ? formatCurrency(totals.total) : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {totals.lastDate ? new Date(totals.lastDate).toLocaleDateString("pt-BR") : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" onClick={() => setProfileCustomer(c)} title="Ver perfil">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Excluir "{c.name}"? Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteCustomer.mutate(c.id)}>
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="mb-4 h-12 w-12 opacity-30" />
                  <p className="text-lg font-medium">Nenhum cliente encontrado</p>
                  <p className="text-sm">Clique em "Novo Cliente" para começar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perguntas-ml">
          <MLQuestionsTab />
        </TabsContent>
      </Tabs>

      {/* Customer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || createCustomer.isPending || updateCustomer.isPending}
            >
              {(createCustomer.isPending || updateCustomer.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRM;
