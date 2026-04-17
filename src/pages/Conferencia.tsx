import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ScanBarcode, CheckCircle, AlertTriangle, Package, Loader2,
  Play, XCircle, Minus, Check, Clock, FileText, ClipboardList,
  ArrowRight, ArrowLeft, Download, RotateCcw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useProducts } from "@/hooks/useProductData";
import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/BarcodeScannerInput";

type Step = 1 | 2 | 3;

interface ScannedProduct {
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  imageUrl: string | null;
  scannedQty: number;
  systemQty: number;
  lastBipAt: Date;
  boxInfo?: { boxes: number; unitsPerBox: number; totalUnits: number; gtinSaved?: boolean };
}

type ConferenceMode = "nf" | "inventario";

interface GtinModalState {
  open: boolean;
  code: string;
  selectedProductId: string;
  unitsPerBox: string;
  boxQty: string;
  saveGtin: boolean;
}

const Conferencia = () => {
  const { toast } = useToast();
  const companyId = useCompanyId();
  const scanInputRef = useRef<BarcodeScannerInputHandle>(null);

  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<ConferenceMode | null>(null);
  const [conferenceName, setConferenceName] = useState("");

  // Step 2
  const [scanBuffer, setScanBuffer] = useState("");
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [lastScan, setLastScan] = useState<{ success: boolean; name: string; code: string } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // GTIN CX modal
  const [gtinModal, setGtinModal] = useState<GtinModalState>({
    open: false, code: "", selectedProductId: "", unitsPerBox: "", boxQty: "1", saveGtin: true
  });

  // Step 3
  const [adjusting, setAdjusting] = useState(false);

  const { data: productsData, refetch: refetchProducts } = useProducts();
  const allProducts = productsData?.products ?? [];

  useEffect(() => {
    if (step === 2 && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [step]);

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

  const addScannedUnits = useCallback((product: any, units: number, boxInfo?: ScannedProduct["boxInfo"]) => {
    setFlashId(product.id);
    setTimeout(() => setFlashId(null), 1000);

    setScannedProducts((prev) => {
      const existing = prev.find((p) => p.productId === product.id);
      if (existing) {
        return prev.map((p) =>
          p.productId === product.id
            ? { ...p, scannedQty: p.scannedQty + units, lastBipAt: new Date(), boxInfo: boxInfo || p.boxInfo }
            : p
        );
      }
      return [
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          imageUrl: product.image_url,
          scannedQty: units,
          systemQty: product.stock_physical,
          lastBipAt: new Date(),
          boxInfo,
        },
        ...prev,
      ];
    });
  }, []);

  const handleScan = useCallback((code: string) => {
    if (!code.trim()) return;
    setScanBuffer("");

    const trimmed = code.trim();
    const normalized = trimmed.toUpperCase();
    const simProducts = (window as any).__simProducts || [];

    const matches = (p: any) => {
      const barcode = (p.barcode || "").toString().trim().toUpperCase();
      const sku = (p.sku || "").toString().trim().toUpperCase();
      const skuMl = (p.sku_ml || "").toString().trim().toUpperCase();
      return barcode === normalized || sku === normalized || skuMl === normalized;
    };

    // 1. Match by barcode, SKU, or SKU ML
    const product = allProducts.find(matches) || simProducts.find(matches);

    if (product) {
      addScannedUnits(product, 1);
      setLastScan({ success: true, name: product.name, code: trimmed });
      playBeep(800, 100);
      scanInputRef.current?.flash(true);
      setTimeout(() => scanInputRef.current?.focus(), 50);
      return;
    }

    // 2. Match by GTIN CX (box code)
    const gtinProduct = allProducts.find((p) => p.gtin_cx && p.gtin_cx === trimmed);
    if (gtinProduct) {
      const unitsPerBox = gtinProduct.box_quantity || 1;
      addScannedUnits(gtinProduct, unitsPerBox, {
        boxes: 1, unitsPerBox, totalUnits: unitsPerBox
      });
      setLastScan({ success: true, name: `📦 ${gtinProduct.name} (${unitsPerBox}un)`, code: trimmed });
      playBeep(800, 100);
      scanInputRef.current?.flash(true);
      setTimeout(() => scanInputRef.current?.focus(), 50);
      return;
    }

    // 3. Unknown code — open GTIN CX modal
    setGtinModal({
      open: true,
      code: trimmed,
      selectedProductId: "",
      unitsPerBox: "",
      boxQty: "1",
      saveGtin: true,
    });
    playBeep(400, 200);
  }, [allProducts, addScannedUnits]);

  const handleGtinConfirm = async () => {
    const product = allProducts.find((p) => p.id === gtinModal.selectedProductId);
    if (!product) return;

    const units = parseInt(gtinModal.unitsPerBox) || 0;
    const boxes = parseInt(gtinModal.boxQty) || 1;
    const totalUnits = units * boxes;

    if (units <= 0) {
      toast({ title: "Informe as unidades por caixa", variant: "destructive" });
      return;
    }

    // Save GTIN CX to product if checkbox is checked
    if (gtinModal.saveGtin) {
      try {
        await supabase
          .from("products")
          .update({ gtin_cx: gtinModal.code, box_quantity: units })
          .eq("id", product.id);
        refetchProducts();
        toast({ title: `GTIN CX salvo no produto ${product.name}!` });
      } catch (err: any) {
        toast({ title: "Erro ao salvar GTIN CX", description: err.message, variant: "destructive" });
      }
    }

    addScannedUnits(product, totalUnits, {
      boxes, unitsPerBox: units, totalUnits, gtinSaved: gtinModal.saveGtin
    });

    setLastScan({ success: true, name: `📦 ${product.name} (${totalUnits}un)`, code: gtinModal.code });
    playBeep(800, 100);
    scanInputRef.current?.flash(true);

    setGtinModal((prev) => ({ ...prev, open: false }));
    setTimeout(() => scanInputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan(scanBuffer);
      setScanBuffer("");
    }
  };

  const decrementQty = (productId: string) => {
    setScannedProducts((prev) =>
      prev
        .map((p) =>
          p.productId === productId ? { ...p, scannedQty: p.scannedQty - 1 } : p
        )
        .filter((p) => p.scannedQty > 0)
    );
  };

  // Step 3 - Results
  const results = useMemo(() => {
    const ok: ScannedProduct[] = [];
    const divergent: ScannedProduct[] = [];
    const notFound: { id: string; name: string; sku: string; systemQty: number }[] = [];

    for (const sp of scannedProducts) {
      if (sp.scannedQty === sp.systemQty) {
        ok.push(sp);
      } else {
        divergent.push(sp);
      }
    }

    for (const p of allProducts) {
      if (p.stock_physical > 0 && !scannedProducts.find((sp) => sp.productId === p.id)) {
        notFound.push({ id: p.id, name: p.name, sku: p.sku, systemQty: p.stock_physical });
      }
    }

    return { ok, divergent, notFound };
  }, [scannedProducts, allProducts]);

  const handleAdjustStock = async () => {
    setAdjusting(true);
    try {
      for (const sp of scannedProducts) {
        if (sp.scannedQty !== sp.systemQty) {
          await supabase
            .from("products")
            .update({ stock_physical: sp.scannedQty })
            .eq("id", sp.productId);
        }
      }
      toast({ title: "Estoque ajustado!", description: `${results.divergent.length} produtos atualizados.` });
    } catch (err: any) {
      toast({ title: "Erro ao ajustar", description: err.message, variant: "destructive" });
    } finally {
      setAdjusting(false);
    }
  };

  const totalScanned = scannedProducts.reduce((s, p) => s + p.scannedQty, 0);
  const uniqueProducts = scannedProducts.length;

  const startConference = () => {
    if (!mode) {
      toast({ title: "Selecione um modo", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const reset = () => {
    setStep(1);
    setMode(null);
    setConferenceName("");
    setScannedProducts([]);
    setLastScan(null);
    setScanBuffer("");
  };

  const gtinTotalUnits = (parseInt(gtinModal.unitsPerBox) || 0) * (parseInt(gtinModal.boxQty) || 0);
  const selectedGtinProduct = allProducts.find((p) => p.id === gtinModal.selectedProductId);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Conferência de Estoque</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === 1 ? "Escolha o tipo de conferência" :
           step === 2 ? "Bipando produtos" :
           "Resultado da conferência"}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-0">
        {["Iniciar", "Bipagem", "Resultado"].map((label, i) => {
          const num = (i + 1) as Step;
          const isActive = step === num;
          const isCompleted = step > num;
          return (
            <div key={label} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                  isCompleted ? "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40" :
                  isActive ? "bg-primary text-primary-foreground border-2 border-primary" :
                  "bg-muted/50 text-muted-foreground border-2 border-border"
                }`}>
                  {isCompleted ? <Check className="h-4 w-4" /> : num}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${
                  isActive ? "text-primary" : isCompleted ? "text-emerald-400" : "text-muted-foreground"
                }`}>
                  {label}
                </span>
              </div>
              {i < 2 && (
                <div className={`flex-1 h-px mx-3 ${isCompleted ? "bg-emerald-500/40" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ========== STEP 1: INICIAR ========== */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <button
              onClick={() => setMode("nf")}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                mode === "nf"
                  ? "border-primary bg-primary/5"
                  : "border-border/40 hover:border-primary/30 bg-card/60"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-xl bg-primary/10 p-3">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-base font-bold text-foreground">Conferência por Nota Fiscal</p>
                  <p className="text-xs text-muted-foreground">Confere produtos de uma NF específica</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setMode("inventario")}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                mode === "inventario"
                  ? "border-primary bg-primary/5"
                  : "border-border/40 hover:border-primary/30 bg-card/60"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-xl bg-amber-500/10 p-3">
                  <ClipboardList className="h-8 w-8 text-amber-400" />
                </div>
                <div>
                  <p className="text-base font-bold text-foreground">Inventário Geral</p>
                  <p className="text-xs text-muted-foreground">Confere todo o estoque</p>
                </div>
              </div>
            </button>
          </div>

          <Card>
            <CardContent className="p-5 space-y-4">
              <label className="text-xs font-medium text-muted-foreground block">Nome da conferência</label>
              <Input
                value={conferenceName}
                onChange={(e) => setConferenceName(e.target.value)}
                placeholder="Ex: Inventário Abril 2026"
              />
              <Button className="w-full" onClick={startConference} disabled={!mode}>
                Iniciar conferência <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== STEP 2: BIPAGEM ========== */}
      {step === 2 && (
        <div className="grid gap-4 md:grid-cols-5">
          {/* Left column (60%) */}
          <div className="md:col-span-3 space-y-4">
            {/* Scan input */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <BarcodeScannerInput
                      ref={scanInputRef}
                      value={scanBuffer}
                      onChange={(v) => setScanBuffer(v)}
                      onScan={(code) => { handleScan(code); setScanBuffer(""); }}
                      placeholder="Bipe ou digite o código de barras..."
                      inputClassName="text-lg h-14 font-mono"
                      icon={<ScanBarcode className="h-5 w-5" />}
                      autoFocus
                      scanMode
                    />
                  </div>
                  <Button className="h-14" onClick={() => { handleScan(scanBuffer); setScanBuffer(""); }} disabled={!scanBuffer.trim()}>
                    Bipar
                  </Button>
                </div>

                {lastScan && (
                  <div className={`rounded-lg p-3 flex items-center gap-2 text-sm ${
                    lastScan.success
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  }`}>
                    {lastScan.success ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                    <span className="font-medium">{lastScan.name}</span>
                    <span className="text-muted-foreground ml-auto font-mono text-xs">{lastScan.code}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scanned products list */}
            <Card className="flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Produtos bipados ({uniqueProducts})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 max-h-[50vh] overflow-y-auto">
                {scannedProducts.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-muted-foreground">
                    <ScanBarcode className="h-12 w-12 opacity-20 mb-3" />
                    <p className="text-sm">Nenhum produto bipado ainda</p>
                    <p className="text-xs">Bipe um código de barras para começar</p>
                  </div>
                ) : (
                  scannedProducts
                    .sort((a, b) => b.lastBipAt.getTime() - a.lastBipAt.getTime())
                    .map((sp) => (
                      <div
                        key={sp.productId}
                        className={`flex items-center gap-3 p-3 rounded-lg border border-border/30 transition-all duration-500 ${
                          flashId === sp.productId ? "!bg-emerald-500/20 !border-emerald-500/40" : "bg-muted/10"
                        }`}
                      >
                        {sp.imageUrl ? (
                          <img src={sp.imageUrl} alt={sp.name} className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted/30 flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sp.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground">{sp.sku}</p>
                          {sp.boxInfo && (
                            <Badge className="mt-1 bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">
                              📦 {sp.boxInfo.boxes}cx × {sp.boxInfo.unitsPerBox}un = {sp.boxInfo.totalUnits}un
                              {sp.boxInfo.gtinSaved && " ✓ GTIN salvo"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => decrementQty(sp.productId)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-bold text-lg w-6 text-center">{sp.scannedQty}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 w-12 text-right">
                          {sp.lastBipAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column (40%) */}
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resumo em tempo real</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-xs text-muted-foreground">Total bipados</p>
                    <p className="text-2xl font-bold text-foreground">{totalScanned}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                    <p className="text-xs text-muted-foreground">Produtos diferentes</p>
                    <p className="text-2xl font-bold text-foreground">{uniqueProducts}</p>
                  </div>
                </div>

                {lastScan && lastScan.success && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">Última leitura</p>
                    <p className="text-sm font-medium text-foreground">{lastScan.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{lastScan.code}</p>
                  </div>
                )}

                {conferenceName && (
                  <div className="p-3 rounded-lg bg-muted/10 border border-border/20">
                    <p className="text-xs text-muted-foreground">Conferência</p>
                    <p className="text-sm font-medium">{conferenceName}</p>
                  </div>
                )}

                <Separator />

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => setStep(3)}
                    disabled={scannedProducts.length === 0}
                  >
                    Finalizar bipagem <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========== STEP 3: RESULTADO ========== */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid gap-3 grid-cols-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">OK</p>
                  <p className="text-xl font-bold">{results.ok.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Divergente</p>
                  <p className="text-xl font-bold">{results.divergent.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-destructive/10 p-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Não bipado</p>
                  <p className="text-xl font-bold">{results.notFound.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* OK Section */}
          {results.ok.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">✅ OK — {results.ok.length}</Badge>
                  Quantidade confere com o sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Qtd Sistema</TableHead>
                      <TableHead className="text-center">Qtd Contada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.ok.map((sp) => (
                      <TableRow key={sp.productId} className="bg-emerald-500/5">
                        <TableCell className="font-medium">{sp.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{sp.sku}</TableCell>
                        <TableCell className="text-center">{sp.systemQty}</TableCell>
                        <TableCell className="text-center font-bold">{sp.scannedQty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Divergent Section */}
          {results.divergent.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">⚠️ Divergente — {results.divergent.length}</Badge>
                  Quantidade diferente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Qtd Sistema</TableHead>
                      <TableHead className="text-center">Qtd Contada</TableHead>
                      <TableHead className="text-center">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.divergent.map((sp) => {
                      const diff = sp.scannedQty - sp.systemQty;
                      return (
                        <TableRow key={sp.productId} className="bg-amber-500/5">
                          <TableCell className="font-medium">{sp.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{sp.sku}</TableCell>
                          <TableCell className="text-center">{sp.systemQty}</TableCell>
                          <TableCell className="text-center font-bold">{sp.scannedQty}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={diff > 0 ? "secondary" : "destructive"}>
                              {diff > 0 ? `+${diff}` : diff}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Not Found Section */}
          {results.notFound.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge className="bg-destructive/15 text-destructive">❌ Não bipado — {results.notFound.length}</Badge>
                  Produto no sistema mas não contado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-center">Qtd Sistema</TableHead>
                        <TableHead className="text-center">Qtd Contada</TableHead>
                        <TableHead className="text-center">Diferença</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.notFound.map((p) => (
                        <TableRow key={p.id} className="bg-destructive/5">
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                          <TableCell className="text-center">{p.systemQty}</TableCell>
                          <TableCell className="text-center font-bold">0</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="destructive">-{p.systemQty}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardContent className="p-5 flex flex-wrap gap-3">
              <Button
                onClick={handleAdjustStock}
                disabled={adjusting || results.divergent.length === 0}
                className="gap-2"
              >
                {adjusting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Ajustar estoque automaticamente
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => {
                const headers = ["Produto", "SKU", "Qtd Sistema", "Qtd Contada", "Diferença", "Status"];
                const rows = [
                  ...results.ok.map(p => [p.name, p.sku, p.systemQty, p.scannedQty, 0, "OK"].join(",")),
                  ...results.divergent.map(p => [p.name, p.sku, p.systemQty, p.scannedQty, p.scannedQty - p.systemQty, "Divergente"].join(",")),
                  ...results.notFound.map(p => [p.name, p.sku, p.systemQty, 0, -p.systemQty, "Não encontrado"].join(",")),
                ];
                const csv = [headers.join(","), ...rows].join("\n");
                const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url;
                a.download = `conferencia_${conferenceName || "resultado"}_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click(); URL.revokeObjectURL(url);
                toast({ title: "Relatório exportado!" });
              }}>
                <Download className="h-4 w-4" /> Exportar relatório
              </Button>
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Voltar à bipagem
              </Button>
              <Button variant="outline" onClick={reset} className="gap-2">
                <RotateCcw className="h-4 w-4" /> Nova conferência
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========== GTIN CX MODAL ========== */}
      <Dialog open={gtinModal.open} onOpenChange={(open) => {
        if (!open) {
          setGtinModal((prev) => ({ ...prev, open: false }));
          setTimeout(() => scanInputRef.current?.focus(), 50);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Código não reconhecido
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Código bipado: <span className="font-mono font-bold">{gtinModal.code}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Selecione a qual produto desta nota pertence esta caixa:
            </p>
          </DialogHeader>

          <RadioGroup
            value={gtinModal.selectedProductId}
            onValueChange={(val) => setGtinModal((prev) => ({ ...prev, selectedProductId: val }))}
            className="space-y-2 max-h-[200px] overflow-y-auto"
          >
            {allProducts.map((p) => (
              <label
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  gtinModal.selectedProductId === p.id
                    ? "border-primary bg-primary/5"
                    : "border-border/40 hover:border-primary/30"
                }`}
              >
                <RadioGroupItem value={p.id} />
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{p.sku}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">Est: {p.stock_physical}</span>
              </label>
            ))}
          </RadioGroup>

          {gtinModal.selectedProductId && (
            <div className="space-y-4 pt-2">
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Unidades por caixa</label>
                  <Input
                    type="number"
                    min="1"
                    value={gtinModal.unitsPerBox}
                    onChange={(e) => setGtinModal((prev) => ({ ...prev, unitsPerBox: e.target.value }))}
                    placeholder="Ex: 12"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Qtd de caixas</label>
                  <Input
                    type="number"
                    min="1"
                    value={gtinModal.boxQty}
                    onChange={(e) => setGtinModal((prev) => ({ ...prev, boxQty: e.target.value }))}
                    placeholder="1"
                  />
                </div>
              </div>

              {gtinTotalUnits > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    Total: <span className="font-bold text-foreground">{gtinModal.unitsPerBox}</span> × <span className="font-bold text-foreground">{gtinModal.boxQty}</span> = <span className="font-bold text-primary text-lg">{gtinTotalUnits} unidades</span>
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                <Checkbox
                  id="save-gtin"
                  checked={gtinModal.saveGtin}
                  onCheckedChange={(checked) => setGtinModal((prev) => ({ ...prev, saveGtin: !!checked }))}
                  className="mt-0.5"
                />
                <label htmlFor="save-gtin" className="text-sm cursor-pointer">
                  <span className="font-medium">Salvar este código como GTIN CX do produto {selectedGtinProduct?.name}</span>
                  <br />
                  <span className="text-xs text-muted-foreground">Nas próximas entradas será reconhecido automaticamente</span>
                </label>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setGtinModal((prev) => ({ ...prev, open: false }));
                setTimeout(() => scanInputRef.current?.focus(), 50);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleGtinConfirm}
              disabled={!gtinModal.selectedProductId || gtinTotalUnits <= 0}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Conferencia;
