import { useState } from "react";
import {
  DollarSign, FileText, CheckCircle2, Clock, AlertTriangle,
  Search, Loader2, CreditCard, Banknote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  useInvoicesWithPayments,
  useCreatePayments,
  useUpdatePayment,
} from "@/hooks/useFinanceiroData";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Financeiro() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: invoices, isLoading } = useInvoicesWithPayments();
  const createPayments = useCreatePayments();
  const updatePayment = useUpdatePayment();

  // Dialog state for creating payments
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isCash, setIsCash] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState("");

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
    const amount = Number(selectedInvoice.total_value) / installments;

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground">Controle de pagamentos de notas fiscais</p>
      </div>

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
                    <>
                      <TableRow
                        key={inv.id}
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
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <DollarSign className="mb-4 h-12 w-12 opacity-30" />
              <p>Nenhuma nota fiscal encontrada</p>
              <p className="text-sm">Importe notas pelo módulo Entrada XML</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                    {installments} x R$ {(Number(selectedInvoice.total_value) / installments).toFixed(2)}
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