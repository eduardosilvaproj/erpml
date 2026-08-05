import { useState, Fragment } from "react";
import {
  DollarSign, FileText, CheckCircle2, Clock, AlertTriangle,
  Search, Loader2, CreditCard, Banknote, Percent, Truck, ArrowDownUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useInvoicesWithPayments,
  useCreatePayments,
  useUpdatePayment,
} from "@/hooks/useFinanceiroData";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// Hook for ML fees data
function useMLFees(days: number) {
  const cid = useCompanyId();
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  const from = new Date(now);
  from.setDate(from.getDate() - days);

  return useQuery({
    queryKey: ["ml-fees", days, cid],
    enabled: !!cid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ml_orders")
        .select("id, ml_order_id, total_amount, marketplace_fee, shipping_cost, date_created, status")
        .gte("date_created", from.toISOString().split("T")[0])
        .lte("date_created", to + "T23:59:59")
        .eq("company_id", cid as string)
        .order("date_created", { ascending: false, nullsFirst: false });
      if (error) throw error;

      const rows = (data || []).map((o: any) => ({
        ...o,
        total_amount: Number(o.total_amount || 0),
        marketplace_fee: Number(o.marketplace_fee || 0),
        shipping_cost: Number(o.shipping_cost || 0),
        net_amount: Number(o.total_amount || 0) - Number(o.marketplace_fee || 0) - Number(o.shipping_cost || 0),
      }));

      const totalCommission = rows.reduce((s: number, r: any) => s + r.marketplace_fee, 0);
      const totalShipping = rows.reduce((s: number, r: any) => s + r.shipping_cost, 0);
      const totalGross = rows.reduce((s: number, r: any) => s + r.total_amount, 0);
      const totalNet = rows.reduce((s: number, r: any) => s + r.net_amount, 0);

      return { rows, totalCommission, totalShipping, totalGross, totalNet, count: rows.length };
    },
  });
}

export default function Financeiro() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mlPeriod, setMLPeriod] = useState("30");
  const { data: invoices, isLoading } = useInvoicesWithPayments();
  const { data: mlFees, isLoading: mlFeesLoading } = useMLFees(parseInt(mlPeriod));
  const createPayments = useCreatePayments();
  const updatePayment = useUpdatePayment();

  // Dialog state for creating payments
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isCash, setIsCash] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState(0);

  // Computed discounted amount
  const invoiceTotal = selectedInvoice ? Number(selectedInvoice.total_value) : 0;
  const discountAmount =
    discountType === "percent"
      ? Math.min(invoiceTotal * (Math.min(discountValue, 100) / 100), invoiceTotal)
      : Math.min(discountValue, invoiceTotal);
  const discountedTotal = invoiceTotal - discountAmount;
  const installmentValue = installments > 0 ? discountedTotal / installments : 0;

  const allInvoices = invoices || [];

  // Compute payment status per invoice
  const invoiceRows = allInvoices.map((inv: any) => {
    const payments: any[] = inv.invoice_payments || [];
    const hasPayments = payments.length > 0;
    const allPaid = hasPayments && payments.every((p: any) => p.status === "pago");
    const totalPaid = payments
      .filter((p: any) => p.status === "pago")
      .reduce((s: number, p: any) => s + Number(p.amount), 0);
    const totalPending = payments
      .filter((p: any) => p.status === "pendente")
      .reduce((s: number, p: any) => s + Number(p.amount), 0);
    const overdue = payments.some(
      (p: any) => p.status === "pendente" && p.due_date && new Date(p.due_date) < new Date()
    );
    return {
      ...inv,
      payments,
      hasPayments,
      allPaid,
      totalPaid,
      totalPending,
      overdue,
      paymentStatus: !hasPayments ? "sem_registro" : allPaid ? "pago" : overdue ? "vencido" : "pendente",
    };
  });

  // Filters
  const filtered = invoiceRows
    .filter((inv) =>
      search
        ? inv.number?.toLowerCase().includes(search.toLowerCase()) ||
          inv.issuer_name?.toLowerCase().includes(search.toLowerCase())
        : true
    )
    .filter((inv) => (statusFilter === "all" ? true : inv.paymentStatus === statusFilter));

  // Summary
  const totalInvoiceValue = invoiceRows.reduce((s, inv) => s + Number(inv.total_value), 0);
  const totalPaidValue = invoiceRows.reduce((s, inv) => s + inv.totalPaid, 0);
  const totalPendingValue = invoiceRows.reduce((s, inv) => s + inv.totalPending, 0);
  const overdueCount = invoiceRows.filter((inv) => inv.overdue).length;

  const handleCreatePayments = async () => {
    if (!selectedInvoice) return;

    const paymentRecords = [];
    const amount = installments > 0 ? discountedTotal / installments : 0;

    for (let i = 0; i < installments; i++) {
      let dueDate: string | null = null;
      if (!isCash && firstDueDate) {
        const d = new Date(firstDueDate);
        d.setMonth(d.getMonth() + i);
        dueDate = d.toISOString().split("T")[0];
      }
      paymentRecords.push({
        invoice_id: selectedInvoice.id,
        due_date: dueDate,
        amount: Math.round(amount * 100) / 100,
        is_cash: isCash,
        status: isCash ? "pago" : "pendente",
        paid_at: isCash ? new Date().toISOString() : null,
        installment_number: i + 1,
      });
    }

    try {
      await createPayments.mutateAsync(paymentRecords);
      toast({ title: "Pagamentos registrados com sucesso!" });
      setDialogOpen(false);
      resetDialog();
    } catch (e: any) {
      toast({ title: "Erro ao registrar", description: e.message, variant: "destructive" });
    }
  };

  const handleMarkPaid = async (paymentId: string) => {
    try {
      await updatePayment.mutateAsync({
        id: paymentId,
        status: "pago",
        paid_at: new Date().toISOString(),
      });
      toast({ title: "Parcela marcada como paga!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const resetDialog = () => {
    setSelectedInvoice(null);
    setIsCash(false);
    setInstallments(1);
    setFirstDueDate("");
    setDiscountType("percent");
    setDiscountValue(0);
  };

  const openPaymentDialog = (inv: any) => {
    setSelectedInvoice(inv);
    // Try to extract due date from XML issue date + 30 days
    if (inv.xml_data) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(inv.xml_data, "text/xml");
        // Look for payment info (cobr/dup/dVenc)
        const dups = doc.getElementsByTagName("dup");
        if (dups.length > 0) {
          const firstVenc = dups[0]?.getElementsByTagName("dVenc")[0]?.textContent;
          if (firstVenc) {
            setFirstDueDate(firstVenc);
            setInstallments(dups.length);
          }
        } else {
          // Fallback: issue date + 30 days
          const dhEmi = doc.getElementsByTagName("dhEmi")[0]?.textContent;
          if (dhEmi) {
            const d = new Date(dhEmi);
            d.setDate(d.getDate() + 30);
            setFirstDueDate(d.toISOString().split("T")[0]);
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    setDialogOpen(true);
  };

  // Expanded row state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground">Controle financeiro — notas fiscais e taxas Mercado Livre</p>
      </div>

      <Tabs defaultValue="notas">
        <TabsList>
          <TabsTrigger value="notas">
            <FileText className="mr-2 h-4 w-4" />
            Notas Fiscais
          </TabsTrigger>
          <TabsTrigger value="taxas-ml">
            <Percent className="mr-2 h-4 w-4" />
            Taxas ML
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notas" className="space-y-6">
          {/* Summary */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Notas</p>
                  <p className="text-xl font-bold">R$ {totalInvoiceValue.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Pago</p>
                  <p className="text-xl font-bold text-emerald-600">R$ {totalPaidValue.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pendente</p>
                  <p className="text-xl font-bold text-amber-600">R$ {totalPendingValue.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-destructive/10 p-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencidas</p>
                  <p className="text-xl font-bold text-destructive">{overdueCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Notas Fiscais - Pagamentos
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número ou fornecedor..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sem_registro">Sem Registro</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NF</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-center">Parcelas</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-right">Pendente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((inv) => (
                        <Fragment key={inv.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                          >
                            <TableCell className="font-mono text-sm">{inv.number}</TableCell>
                            <TableCell>{inv.issuer_name || "-"}</TableCell>
                            <TableCell className="text-right font-medium">
                              R$ {Number(inv.total_value).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">{inv.payments.length || "-"}</TableCell>
                            <TableCell className="text-right text-emerald-600 font-medium">
                              {inv.totalPaid > 0 ? `R$ ${inv.totalPaid.toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell className="text-right text-amber-600 font-medium">
                              {inv.totalPending > 0 ? `R$ ${inv.totalPending.toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell>
                              {inv.paymentStatus === "pago" && (
                                <Badge className="bg-emerald-500/15 text-emerald-700">Pago</Badge>
                              )}
                              {inv.paymentStatus === "pendente" && (
                                <Badge className="bg-amber-500/15 text-amber-700">Pendente</Badge>
                              )}
                              {inv.paymentStatus === "vencido" && (
                                <Badge variant="destructive">Vencido</Badge>
                              )}
                              {inv.paymentStatus === "sem_registro" && (
                                <Badge variant="secondary">Sem Registro</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {!inv.hasPayments && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPaymentDialog(inv);
                                  }}
                                >
                                  <CreditCard className="mr-1 h-3 w-3" />
                                  Registrar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedId === inv.id && inv.payments.length > 0 && (
                            <TableRow key={`${inv.id}-detail`}>
                              <TableCell colSpan={8} className="bg-muted/30 p-4">
                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-muted-foreground">Parcelas:</p>
                                  <div className="grid gap-2">
                                    {inv.payments
                                      .sort((a: any, b: any) => a.installment_number - b.installment_number)
                                      .map((p: any) => (
                                        <div
                                          key={p.id}
                                          className="flex items-center justify-between rounded-lg border bg-background p-3"
                                        >
                                          <div className="flex items-center gap-3">
                                            <span className="text-sm font-medium">
                                              Parcela {p.installment_number}
                                            </span>
                                            {p.is_cash && (
                                              <Badge variant="secondary" className="text-xs">
                                                <Banknote className="mr-1 h-3 w-3" />
                                                À Vista
                                              </Badge>
                                            )}
                                            {p.due_date && (
                                              <span className="text-xs text-muted-foreground">
                                                Vencimento: {format(new Date(p.due_date + "T00:00:00"), "dd/MM/yyyy")}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="font-medium">
                                              R$ {Number(p.amount).toFixed(2)}
                                            </span>
                                            {p.status === "pago" ? (
                                              <Badge className="bg-emerald-500/15 text-emerald-700">
                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                                Pago
                                                {p.paid_at && ` em ${format(new Date(p.paid_at), "dd/MM/yyyy")}`}
                                              </Badge>
                                            ) : (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleMarkPaid(p.id)}
                                                disabled={updatePayment.isPending}
                                              >
                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                                Pagar
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <DollarSign className="mb-4 h-12 w-12 opacity-30" />
                  <p>Nenhuma nota fiscal encontrada</p>
                  <p className="text-sm">Importe notas pelo módulo Entrada Nota</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxas-ml" className="space-y-6">
          {/* Period filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Período:</span>
            {["7", "15", "30", "90"].map((d) => (
              <Button
                key={d}
                variant={mlPeriod === d ? "default" : "outline"}
                size="sm"
                onClick={() => setMLPeriod(d)}
              >
                {d}d
              </Button>
            ))}
          </div>

          {mlFeesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : mlFees && mlFees.count > 0 ? (
            <>
              {/* Summary cards */}
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Bruto</p>
                      <p className="text-xl font-bold">{formatCurrency(mlFees.totalGross)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="rounded-lg bg-amber-500/10 p-2">
                      <Percent className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Comissão ML</p>
                      <p className="text-xl font-bold text-amber-500">{formatCurrency(mlFees.totalCommission)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="rounded-lg bg-sky-500/10 p-2">
                      <Truck className="h-5 w-5 text-sky-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Frete ML</p>
                      <p className="text-xl font-bold text-sky-500">{formatCurrency(mlFees.totalShipping)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="rounded-lg bg-emerald-500/10 p-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Líquido</p>
                      <p className="text-xl font-bold text-emerald-500">{formatCurrency(mlFees.totalNet)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detail table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowDownUp className="h-4 w-4" />
                    Detalhamento ({mlFees.count} pedidos)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead className="text-right">Valor Bruto</TableHead>
                          <TableHead className="text-right">Comissão</TableHead>
                          <TableHead className="text-right">Frete</TableHead>
                          <TableHead className="text-right">Líquido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mlFees.rows.map((row: any) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-sm">
                              {row.date_created
                                ? new Date(row.date_created).toLocaleDateString("pt-BR")
                                : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-sm">#{row.ml_order_id}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.total_amount)}</TableCell>
                            <TableCell className="text-right text-amber-500">{formatCurrency(row.marketplace_fee)}</TableCell>
                            <TableCell className="text-right text-sky-500">{formatCurrency(row.shipping_cost)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(row.net_amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Percent className="mb-4 h-12 w-12 opacity-30" />
              <p>Nenhum pedido ML encontrado no período</p>
              <p className="text-sm">Sincronize pedidos do Mercado Livre para ver as taxas</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetDialog(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm">
                  <strong>NF:</strong> {selectedInvoice.number} — {selectedInvoice.issuer_name}
                </p>
                <p className="text-sm font-medium">
                  Valor: R$ {Number(selectedInvoice.total_value).toFixed(2)}
                </p>
              </div>

              {/* Discount Section */}
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Desconto</Label>
                  <div className="flex items-center gap-1 rounded-md border p-0.5">
                    <button
                      type="button"
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        discountType === "percent"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => { setDiscountType("percent"); setDiscountValue(0); }}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        discountType === "fixed"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => { setDiscountType("fixed"); setDiscountValue(0); }}
                    >
                      R$
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    {discountType === "fixed" && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    )}
                    <Input
                      type="number"
                      min={0}
                      max={discountType === "percent" ? 100 : invoiceTotal}
                      step={discountType === "percent" ? 1 : 0.01}
                      placeholder={discountType === "percent" ? "0%" : "0,00"}
                      className={discountType === "fixed" ? "pl-8" : ""}
                      value={discountValue || ""}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                {discountAmount > 0 && (
                  <div className="text-xs space-y-0.5">
                    <p className="text-muted-foreground">
                      Desconto: <span className="text-emerald-600 font-medium">- R$ {discountAmount.toFixed(2)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Valor com desconto: <span className="font-medium">R$ {discountedTotal.toFixed(2)}</span>
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-cash"
                  checked={isCash}
                  onCheckedChange={(v) => {
                    setIsCash(!!v);
                    if (v) setInstallments(1);
                  }}
                />
                <Label htmlFor="is-cash" className="cursor-pointer">
                  Pagamento à vista
                </Label>
              </div>

              {!isCash && (
                <>
                  <div>
                    <Label>Número de Parcelas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={48}
                      value={installments}
                      onChange={(e) => setInstallments(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <Label>Data 1º Vencimento</Label>
                    <Input
                      type="date"
                      value={firstDueDate}
                      onChange={(e) => setFirstDueDate(e.target.value)}
                    />
                    {firstDueDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Extraído automaticamente da NF-e quando disponível
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {installments} x R$ {installmentValue.toFixed(2)}
                    {discountAmount > 0 && (
                      <span className="text-emerald-600 ml-1">
                        (com desconto)
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetDialog(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreatePayments}
              disabled={createPayments.isPending || (!isCash && !firstDueDate)}
            >
              {createPayments.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}