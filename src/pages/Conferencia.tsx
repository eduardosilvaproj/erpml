import { useState, useRef, useEffect, useCallback } from "react";
import {
  ScanBarcode, CheckCircle, AlertTriangle, Package, Loader2,
  Play, XCircle, ChevronDown, ChevronUp, Check, Clock, Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  useConferences, usePendingInvoices, useStartConference,
  useScanItem, useFinishConference, type Conference
} from "@/hooks/useConferenceData";

const Conferencia = () => {
  const { toast } = useToast();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [activeConference, setActiveConference] = useState<Conference | null>(null);
  const [scanBuffer, setScanBuffer] = useState("");
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    message: string;
    productName?: string;
    scanned?: number;
    expected?: number;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showHistory, setShowHistory] = useState(true);

  const { data: pendingInvoices } = usePendingInvoices();
  const { data: conferences, refetch: refetchConferences } = useConferences({
    status: statusFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const startConference = useStartConference();
  const scanItem = useScanItem();
  const finishConference = useFinishConference();

  // Auto-focus scan input
  useEffect(() => {
    if (activeConference && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [activeConference]);

  // Re-fetch active conference data
  useEffect(() => {
    if (activeConference && conferences) {
      const updated = conferences.find((c) => c.id === activeConference.id);
      if (updated) setActiveConference(updated);
    }
  }, [conferences]);

  const handleStartConference = async (invoiceId: string) => {
    const conf = await startConference.mutateAsync(invoiceId);
    // Refetch to get full data with relations
    await refetchConferences();
    const fullConf = conferences?.find((c) => c.id === conf.id);
    // Set after next fetch
    setTimeout(async () => {
      const { data } = await refetchConferences();
      const found = data?.find((c: Conference) => c.id === conf.id);
      if (found) setActiveConference(found);
    }, 500);
  };

  const handleScan = useCallback(async (code: string) => {
    if (!activeConference || !code.trim()) return;

    try {
      const result = await scanItem.mutateAsync({
        conferenceId: activeConference.id,
        barcode: code.trim(),
      });
      setLastScanResult({
        success: true,
        message: result.status === "ok" ? "✓ Quantidade correta!" : `${result.newQty}/${result.expected}`,
        productName: result.productName || "",
        scanned: result.newQty,
        expected: result.expected,
      });

      // Play sound feedback
      if (result.status === "ok") {
        playBeep(800, 150);
      } else if (result.status === "excedente") {
        playBeep(300, 400);
      } else {
        playBeep(600, 100);
      }
    } catch (err: any) {
      setLastScanResult({
        success: false,
        message: err.message || "Produto não encontrado",
      });
      playBeep(200, 500);
    }

    setScanBuffer("");
    // Re-focus
    setTimeout(() => scanInputRef.current?.focus(), 50);
  }, [activeConference, scanItem]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan(scanBuffer);
    }
  };

  const handleFinish = async () => {
    if (!activeConference) return;
    await finishConference.mutateAsync(activeConference.id);
    setActiveConference(null);
    setLastScanResult(null);
  };

  const playBeep = (freq: number, duration: number) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, duration);
    } catch {}
  };

  // Conference progress
  const confItems = activeConference?.conference_items || [];
  const totalItems = confItems.length;
  const okItems = confItems.filter((i) => i.status === "ok").length;
  const divergentItems = confItems.filter((i) => i.status === "excedente" || i.status === "divergente").length;
  const pendingItems = confItems.filter((i) => i.status === "pendente").length;
  const progressPct = totalItems > 0 ? Math.round((okItems / totalItems) * 100) : 0;

  const itemStatusIcon = (status: string) => {
    switch (status) {
      case "ok": return <CheckCircle className="h-5 w-5 text-emerald-600" />;
      case "excedente": return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case "divergente": return <XCircle className="h-5 w-5 text-destructive" />;
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const confStatusBadge = (status: string) => {
    const map: Record<string, { label: string; class: string }> = {
      em_andamento: { label: "Em andamento", class: "bg-primary/10 text-primary" },
      conferida: { label: "Conferida", class: "bg-emerald-500/15 text-emerald-700" },
      divergente: { label: "Divergente", class: "bg-destructive/15 text-destructive" },
    };
    const s = map[status] || map.em_andamento;
    return <Badge className={s.class}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Conferência com Bip</h1>
        <p className="text-muted-foreground">Confira produtos recebidos via leitor de código de barras</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aguardando</p>
              <p className="text-2xl font-bold">{pendingInvoices?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <ScanBarcode className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Em conferência</p>
              <p className="text-2xl font-bold">
                {conferences?.filter((c) => c.status === "em_andamento").length ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Conferidas</p>
              <p className="text-2xl font-bold">
                {conferences?.filter((c) => c.status === "conferida").length ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== ACTIVE CONFERENCE ===== */}
      {activeConference ? (
        <div className="space-y-4">
          {/* Conference header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ScanBarcode className="h-5 w-5" />
                  Conferência — NF-e #{activeConference.invoices?.number}
                </CardTitle>
                {confStatusBadge(activeConference.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{okItems}/{totalItems} conferidos</span>
                </div>
                <Progress value={progressPct} className="h-3" />
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" /> OK: {okItems}
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground" /> Pendente: {pendingItems}
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-amber-500" /> Divergente: {divergentItems}
                  </span>
                </div>
              </div>

              {/* Scan input — auto-focus, barcode as keyboard */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={scanInputRef}
                    value={scanBuffer}
                    onChange={(e) => setScanBuffer(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Bipe o código de barras ou digite e pressione Enter..."
                    className="pl-11 text-lg h-14 font-mono"
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <Button
                  size="lg"
                  className="h-14"
                  onClick={() => handleScan(scanBuffer)}
                  disabled={!scanBuffer.trim() || scanItem.isPending}
                >
                  {scanItem.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Bipar"}
                </Button>
              </div>

              {/* Last scan feedback */}
              {lastScanResult && (
                <div
                  className={`rounded-lg p-4 flex items-center gap-3 transition-all ${
                    lastScanResult.success
                      ? lastScanResult.scanned === lastScanResult.expected
                        ? "bg-emerald-50 border border-emerald-200"
                        : (lastScanResult.scanned ?? 0) > (lastScanResult.expected ?? 0)
                          ? "bg-amber-50 border border-amber-200"
                          : "bg-primary/5 border border-primary/20"
                      : "bg-destructive/5 border border-destructive/20"
                  }`}
                >
                  {lastScanResult.success ? (
                    lastScanResult.scanned === lastScanResult.expected ? (
                      <CheckCircle className="h-8 w-8 text-emerald-600 shrink-0" />
                    ) : (lastScanResult.scanned ?? 0) > (lastScanResult.expected ?? 0) ? (
                      <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0" />
                    ) : (
                      <Package className="h-8 w-8 text-primary shrink-0" />
                    )
                  ) : (
                    <XCircle className="h-8 w-8 text-destructive shrink-0" />
                  )}
                  <div>
                    <p className="font-medium">
                      {lastScanResult.productName || (lastScanResult.success ? "Bipado" : "Erro")}
                    </p>
                    <p className="text-sm text-muted-foreground">{lastScanResult.message}</p>
                  </div>
                  {lastScanResult.success && lastScanResult.expected && (
                    <div className="ml-auto text-right">
                      <p className="text-2xl font-bold">
                        {lastScanResult.scanned}/{lastScanResult.expected}
                      </p>
                      <p className="text-xs text-muted-foreground">bipado/esperado</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itens da Conferência</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">Status</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Esperado</TableHead>
                    <TableHead className="text-center">Bipado</TableHead>
                    <TableHead className="text-center">Diferença</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confItems.map((item) => {
                    const diff = item.scanned_quantity - item.expected_quantity;
                    return (
                      <TableRow
                        key={item.id}
                        className={
                          item.status === "ok"
                            ? "bg-emerald-50/50"
                            : item.status === "excedente"
                              ? "bg-amber-50/50"
                              : ""
                        }
                      >
                        <TableCell>{itemStatusIcon(item.status)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.invoice_items?.xml_code}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.invoice_items?.xml_description}
                        </TableCell>
                        <TableCell className="text-center font-medium">{item.expected_quantity}</TableCell>
                        <TableCell className="text-center font-bold text-lg">{item.scanned_quantity}</TableCell>
                        <TableCell className="text-center">
                          {diff !== 0 && (
                            <Badge variant={diff > 0 ? "secondary" : "destructive"}>
                              {diff > 0 ? `+${diff}` : diff}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => { setActiveConference(null); setLastScanResult(null); }}
            >
              Voltar
            </Button>
            <Button
              onClick={handleFinish}
              disabled={finishConference.isPending || pendingItems === totalItems}
            >
              {finishConference.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Check className="mr-2 h-4 w-4" />
              Finalizar Conferência
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* ===== SELECT INVOICE TO CONFERENCE ===== */}
          {pendingInvoices && pendingInvoices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notas Aguardando Conferência</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº NF-e</TableHead>
                      <TableHead>Emitente</TableHead>
                      <TableHead className="text-center">Itens</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-[120px]">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono">{inv.number}</TableCell>
                        <TableCell>{inv.issuer_name || "—"}</TableCell>
                        <TableCell className="text-center">{inv.items_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleStartConference(inv.id)}
                            disabled={startConference.isPending}
                          >
                            {startConference.isPending ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="mr-1 h-3 w-3" />
                            )}
                            Iniciar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== HISTORY ===== */}
          <Card>
            <CardHeader
              className="cursor-pointer"
              onClick={() => setShowHistory(!showHistory)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Histórico de Conferências ({conferences?.length ?? 0})
                </CardTitle>
                {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {showHistory && (
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-center">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="em_andamento">Em andamento</SelectItem>
                      <SelectItem value="conferida">Conferida</SelectItem>
                      <SelectItem value="divergente">Divergente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-[160px]"
                    placeholder="De"
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-[160px]"
                    placeholder="Até"
                  />
                  {(statusFilter !== "all" || dateFrom || dateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setStatusFilter("all"); setDateFrom(""); setDateTo(""); }}
                    >
                      Limpar
                    </Button>
                  )}
                </div>

                {conferences && conferences.length > 0 ? (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NF-e</TableHead>
                        <TableHead>Emitente</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Itens</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead className="w-[100px]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conferences.map((conf) => (
                        <TableRow key={conf.id}>
                          <TableCell className="font-mono">{conf.invoices?.number}</TableCell>
                          <TableCell>{conf.invoices?.issuer_name || "—"}</TableCell>
                          <TableCell>{confStatusBadge(conf.status)}</TableCell>
                          <TableCell className="text-center">{conf.conference_items?.length ?? 0}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(conf.started_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {conf.finished_at ? new Date(conf.finished_at).toLocaleDateString("pt-BR") : "—"}
                          </TableCell>
                          <TableCell>
                            {conf.status === "em_andamento" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setActiveConference(conf)}
                              >
                                Continuar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ScanBarcode className="mb-3 h-10 w-10 opacity-30" />
                    <p>Nenhuma conferência encontrada</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default Conferencia;
