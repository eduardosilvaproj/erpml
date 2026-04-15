import { useState, useCallback, useRef, useEffect } from "react";
import {
  FileText, Loader2, CheckCircle, AlertTriangle, ArrowLeft, ScanBarcode,
  Keyboard, Package, ArrowRight, Bot, Search, Plus, Minus, Trash2, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQueryClient } from "@tanstack/react-query";
import { parseNFeXml, matchProducts, type NFeData, type MatchResult, type NFeProduct } from "@/lib/nfe-parser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface ConferenceItem {
  xmlProduct: NFeProduct;
  matchedProductId: string | null;
  matchedProductName: string | null;
  matchType: string;
  expectedQty: number;
  scannedQty: number;
  status: "pending" | "partial" | "ok" | "excess" | "not_found";
}

const STEP_LABELS = ["NF", "Conferência", "Divergências", "Ajustes XML", "Confirmar"];

const EntradaNota = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const queryClient = useQueryClient();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1 - NF
  const [nfMode, setNfMode] = useState<"sefaz" | "xml">("sefaz");
  const [nfNumber, setNfNumber] = useState("");
  const [nfSeries, setNfSeries] = useState("001");
  const [nfFornecedor, setNfFornecedor] = useState("");
  const [nfDate, setNfDate] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [nfeData, setNfeData] = useState<NFeData | null>(null);
  const [nfeChave, setNfeChave] = useState("");
  const [matches, setMatches] = useState<MatchResult[]>([]);

  // Step 2 - Conference
  const [conferenceItems, setConferenceItems] = useState<ConferenceItem[]>([]);
  const [bipInput, setBipInput] = useState("");
  const bipRef = useRef<HTMLInputElement>(null);
  const [bipAlert, setBipAlert] = useState<{ type: "success" | "warning" | "error"; msg: string } | null>(null);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);

  // Step 3 - Divergences
  const [divergences, setDivergences] = useState<ConferenceItem[]>([]);
  const [divergenceActions, setDivergenceActions] = useState<Record<number, "conferida" | "nota">>({});

  // Step 4 - Adjustments
  const [adjustedItems, setAdjustedItems] = useState<MatchResult[]>([]);
  const [newProductDialog, setNewProductDialog] = useState(false);
  const [newProductData, setNewProductData] = useState({ name: "", ean: "", sku: "", price: "" });
  const [entryNotes, setEntryNotes] = useState("");

  // Step 5 - Confirm
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [autoUpdateStock, setAutoUpdateStock] = useState(true);
  const [autoUpdateCost, setAutoUpdateCost] = useState(true);

  // XML file upload
  const fileRef = useRef<HTMLInputElement>(null);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  // ========== STEP 1: NF ==========
  const consultarChave = useCallback(async (chave: string) => {
    const clean = chave.replace(/\D/g, "");
    if (clean.length !== 44) {
      toast({ title: "Chave inválida", description: "A chave deve ter 44 dígitos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nfe-consulta", { body: { chave: clean } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setNfeChave(clean);
      const nfe: NFeData = {
        number: data.numero,
        series: data.serie,
        issuerName: `Emitente ${data.cnpjFormatado} (${data.uf})`,
        issuerCnpj: data.cnpjEmitente,
        totalValue: 0,
        issueDate: data.dataEmissao,
        products: [],
      };
      setNfeData(nfe);
      setNfNumber(data.numero);
      setNfSeries(data.serie || "001");
      setNfFornecedor(nfe.issuerName);
      toast({ title: "Nota encontrada!", description: `NF-e nº ${data.numero} identificada.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao consultar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const xml = await file.text();
      const parsed = parseNFeXml(xml);
      const { data: dbProducts } = await supabase.from("products").select("id, name, barcode, sku");
      const matched = matchProducts(parsed.products, dbProducts || []);
      setNfeData(parsed);
      setMatches(matched);
      setNfNumber(parsed.number);
      setNfSeries(parsed.series || "001");
      setNfFornecedor(parsed.issuerName);
      setNfDate(parsed.issueDate || "");
      toast({ title: "XML importado!", description: `${parsed.products.length} produtos encontrados.` });
    } catch (err: any) {
      toast({ title: "Erro no XML", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const goToStep = (step: WizardStep) => {
    if (step === 2 && nfeData) {
      const items: ConferenceItem[] = matches.map((m) => ({
        xmlProduct: m.xmlProduct,
        matchedProductId: m.matchedProductId,
        matchedProductName: m.matchedProductName,
        matchType: m.matchType,
        expectedQty: Math.floor(m.xmlProduct.quantity),
        scannedQty: 0,
        status: "pending",
      }));
      setConferenceItems(items);
      setCompletedSteps((p) => new Set([...p, 1]));
    }
    if (step === 3) {
      const divs = conferenceItems.filter((i) => i.status !== "ok");
      setDivergences(divs);
      setDivergenceActions({});
      setCompletedSteps((p) => new Set([...p, 2]));
    }
    if (step === 4) {
      setAdjustedItems([...matches]);
      setCompletedSteps((p) => new Set([...p, 3]));
    }
    if (step === 5) {
      setCompletedSteps((p) => new Set([...p, 4]));
    }
    setCurrentStep(step);
  };

  // ========== STEP 2: CONFERENCE (BIP) ==========
  useEffect(() => {
    if (currentStep === 2 && bipRef.current) {
      bipRef.current.focus();
    }
  }, [currentStep]);

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

  const handleBip = (code: string) => {
    if (!code.trim()) return;
    setBipInput("");
    setBipAlert(null);

    const idx = conferenceItems.findIndex(
      (i) => i.xmlProduct.ean === code || i.xmlProduct.code === code
    );

    if (idx === -1) {
      setBipAlert({ type: "error", msg: `Produto "${code}" não pertence a esta nota!` });
      playBeep(200, 400);
      setTimeout(() => bipRef.current?.focus(), 50);
      return;
    }

    setFlashIdx(idx);
    setTimeout(() => setFlashIdx(null), 1000);

    setConferenceItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[idx] };
      item.scannedQty += 1;

      if (item.scannedQty === item.expectedQty) {
        item.status = "ok";
        setBipAlert({ type: "success", msg: `✓ ${item.xmlProduct.description} — conferido!` });
        playBeep(800, 100);
      } else if (item.scannedQty > item.expectedQty) {
        item.status = "excess";
        setBipAlert({ type: "warning", msg: `⚠ ${item.xmlProduct.description} — excede a quantidade esperada!` });
        playBeep(200, 150);
        setTimeout(() => playBeep(200, 150), 200);
      } else {
        item.status = "partial";
        setBipAlert({ type: "success", msg: `${item.xmlProduct.description}: ${item.scannedQty}/${item.expectedQty}` });
        playBeep(600, 100);
      }

      updated[idx] = item;
      return updated;
    });

    setTimeout(() => bipRef.current?.focus(), 50);
  };

  const conferenceProgress = conferenceItems.length > 0
    ? conferenceItems.filter((i) => i.status === "ok").length
    : 0;

  // ========== STEP 4: ADJUSTMENTS ==========
  const removeAdjustedItem = (idx: number) => {
    setAdjustedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateAdjustedQty = (idx: number, qty: number) => {
    setAdjustedItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, xmlProduct: { ...item.xmlProduct, quantity: qty } } : item
      )
    );
  };

  const updateAdjustedCost = (idx: number, cost: number) => {
    setAdjustedItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, xmlProduct: { ...item.xmlProduct, unitValue: cost, totalValue: cost * item.xmlProduct.quantity } } : item
      )
    );
  };

  const addNewProduct = async () => {
    if (!newProductData.name || !newProductData.sku) {
      toast({ title: "Preencha nome e SKU", variant: "destructive" });
      return;
    }
    const { data: product, error } = await supabase.from("products").insert({
      name: newProductData.name,
      sku: newProductData.sku,
      barcode: newProductData.ean || null,
      price: parseFloat(newProductData.price) || 0,
      cost: 0,
      stock_physical: 0,
      min_stock: 1,
      active: true,
      company_id: companyId,
    }).select().single();

    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Produto cadastrado!" });
    setNewProductDialog(false);
    setNewProductData({ name: "", ean: "", sku: "", price: "" });
  };

  // ========== STEP 5: CONFIRM ==========
  const confirmarEntrada = async () => {
    if (!nfeData) return;
    setSaving(true);

    try {
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("number", nfeData.number)
        .eq("issuer_cnpj", nfeData.issuerCnpj)
        .eq("company_id", companyId)
        .maybeSingle();

      if (existing) {
        toast({ title: "Nota já importada", description: `NF-e nº ${nfeData.number} já existe.`, variant: "destructive" });
        setSaving(false);
        return;
      }

      const itemsToImport = adjustedItems.length > 0 ? adjustedItems : matches;

      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          number: nfeData.number,
          series: nfeData.series,
          issuer_cnpj: nfeData.issuerCnpj,
          issuer_name: nfeData.issuerName,
          total_value: nfeData.totalValue,
          status: "conferida",
          items_count: itemsToImport.length,
          company_id: companyId,
        })
        .select()
        .single();

      if (invError) {
        if (invError.code === "23505") {
          toast({ title: "Nota já importada", variant: "destructive" });
          setSaving(false);
          return;
        }
        throw invError;
      }

      for (const match of itemsToImport) {
        let productId = match.matchedProductId;

        await supabase.from("invoice_items").insert({
          invoice_id: invoice.id,
          product_id: productId,
          xml_code: match.xmlProduct.code,
          xml_description: match.xmlProduct.description,
          xml_ean: match.xmlProduct.ean || "",
          xml_ncm: match.xmlProduct.ncm || "",
          xml_cfop: match.xmlProduct.cfop || "",
          xml_unit: match.xmlProduct.unit || "UN",
          quantity: match.xmlProduct.quantity,
          unit_value: match.xmlProduct.unitValue,
          total_value: match.xmlProduct.totalValue,
          match_type: productId ? match.matchType : "none",
          match_confidence: match.confidence,
          stock_updated: !!productId && autoUpdateStock,
        });

        if (productId && autoUpdateStock) {
          const { data: current } = await supabase
            .from("products")
            .select("stock_physical, cost")
            .eq("id", productId)
            .single();

          if (current) {
            const qty = Math.floor(match.xmlProduct.quantity);
            const newStock = current.stock_physical + qty;
            
            if (autoUpdateCost) {
              const totalOldCost = current.stock_physical * current.cost;
              const totalNewCost = match.xmlProduct.quantity * match.xmlProduct.unitValue;
              const avgCost = newStock > 0 ? (totalOldCost + totalNewCost) / newStock : match.xmlProduct.unitValue;
              await supabase.from("products").update({
                stock_physical: newStock,
                cost: Math.round(avgCost * 100) / 100,
              }).eq("id", productId);
            } else {
              await supabase.from("products").update({
                stock_physical: newStock,
              }).eq("id", productId);
            }
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });

      setDone(true);
      toast({ title: "Entrada confirmada!", description: "Estoque atualizado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro ao confirmar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setNfMode("sefaz");
    setManualKey("");
    setNfNumber("");
    setNfSeries("001");
    setNfFornecedor("");
    setNfDate("");
    setNfeData(null);
    setNfeChave("");
    setMatches([]);
    setConferenceItems([]);
    setDivergences([]);
    setAdjustedItems([]);
    setDone(false);
    setSaving(false);
    setBipAlert(null);
    setBipInput("");
    setEntryNotes("");
    setAutoUpdateStock(true);
    setAutoUpdateCost(true);
  };

  const canGoToStep = (step: number) => {
    if (step === 1) return true;
    if (step === 2) return !!nfeData && matches.length > 0;
    if (step === 3) return completedSteps.has(2);
    if (step === 4) return completedSteps.has(2);
    if (step === 5) return completedSteps.has(4) || completedSteps.has(3);
    return false;
  };

  const itemsToShow = adjustedItems.length > 0 ? adjustedItems : matches;
  const totalValue = itemsToShow.reduce((sum, m) => sum + m.xmlProduct.totalValue, 0);

  // ========== RENDER ==========
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Entrada de Mercadoria</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Passo {currentStep} — {STEP_LABELS[currentStep - 1]}
        </p>
      </div>

      {/* Step Progress Bar */}
      <div className="flex items-center gap-0">
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as WizardStep;
          const isActive = currentStep === stepNum;
          const isCompleted = completedSteps.has(stepNum);
          const isClickable = canGoToStep(stepNum);

          return (
            <div key={label} className="flex items-center flex-1">
              <button
                disabled={!isClickable}
                onClick={() => isClickable && goToStep(stepNum)}
                className={`flex items-center gap-2 ${isClickable ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                  isCompleted
                    ? "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40"
                    : isActive
                    ? "bg-primary text-primary-foreground border-2 border-primary"
                    : "bg-muted/50 text-muted-foreground border-2 border-border"
                }`}>
                  {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${
                  isActive ? "text-primary" : isCompleted ? "text-emerald-400" : "text-muted-foreground"
                }`}>
                  {label}
                </span>
              </button>
              {i < STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-px mx-3 ${
                  completedSteps.has(stepNum) ? "bg-emerald-500/40" : "bg-border"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ========== STEP 1: NF ========== */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* AI Banner */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Assistente de Importação</p>
              <p className="text-xs text-muted-foreground mt-1">
                Mercadoria chegou? Digite o número da NF ou escaneie o código de barras da nota. O sistema vai buscar o XML automaticamente na SEFAZ.
              </p>
            </div>
          </div>

          {/* NF Form Fields */}
          <Card>
            <CardContent className="p-5 space-y-5">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Nota Fiscal de Entrada</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Número NF</label>
                  <Input value={nfNumber} onChange={(e) => setNfNumber(e.target.value)} placeholder="000123" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Série</label>
                  <Input value={nfSeries} onChange={(e) => setNfSeries(e.target.value)} placeholder="001" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fornecedor</label>
                  <Input value={nfFornecedor} onChange={(e) => setNfFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data Emissão</label>
                  <Input type="date" value={nfDate} onChange={(e) => setNfDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Qtd Itens</label>
                  <Input value={nfeData ? (nfeData.products.length || matches.length) : "—"} readOnly className="bg-muted/20 cursor-default" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valor Total</label>
                  <Input value={nfeData ? formatCurrency(nfeData.totalValue) : "—"} readOnly className="bg-muted/20 cursor-default" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              variant={nfMode === "sefaz" ? "default" : "outline"}
              className="flex-1 min-h-[44px] gap-2"
              onClick={() => setNfMode("sefaz")}
            >
              <Search className="h-4 w-4" />
              Buscar na SEFAZ
            </Button>
            <Button
              variant={nfMode === "xml" ? "default" : "outline"}
              className="flex-1 min-h-[44px] gap-2"
              onClick={() => setNfMode("xml")}
            >
              <FileText className="h-4 w-4" />
              Upload XML
            </Button>
          </div>

          {/* SEFAZ mode */}
          {nfMode === "sefaz" && !nfeData && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-medium">Chave de Acesso (44 dígitos)</p>
                <Input
                  placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  className="min-h-[48px] text-base font-mono tracking-wider"
                  maxLength={54}
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">{manualKey.replace(/\D/g, "").length}/44 dígitos</p>
                <Button className="w-full min-h-[44px]" onClick={() => consultarChave(manualKey)} disabled={loading || manualKey.replace(/\D/g, "").length < 44}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Buscar Nota
                </Button>
                <Button
                  variant="outline"
                  className="w-full min-h-[44px] border-dashed border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => {
                    const fakeNfe: NFeData = {
                      number: "004521",
                      series: "001",
                      issuerCnpj: "00.000.000/0001-00",
                      issuerName: "Distribuidora Alfa LTDA",
                      totalValue: 850.00,
                      products: [
                        { code: "P-A", description: "Produto A", ean: "7891234560011", ncm: "8471.30.19", cfop: "5102", unit: "UN", quantity: 5, unitValue: 50, totalValue: 250 },
                        { code: "P-B", description: "Produto B", ean: "7891234560028", ncm: "8471.30.19", cfop: "5102", unit: "UN", quantity: 3, unitValue: 100, totalValue: 300 },
                        { code: "P-C", description: "Produto C", ean: "7891234560035", ncm: "8471.30.19", cfop: "5102", unit: "UN", quantity: 10, unitValue: 30, totalValue: 300 },
                      ],
                    };
                    const fakeMatches: MatchResult[] = fakeNfe.products.map((p) => ({
                      xmlProduct: p,
                      matchedProductId: null,
                      matchedProductName: null,
                      matchType: "none" as const,
                      confidence: 0,
                    }));
                    setNfeData(fakeNfe);
                    setNfeChave("35260400000000000100550010045210001004521001");
                    setMatches(fakeMatches);
                    setConferenceItems(fakeMatches.map((m) => ({
                      xmlProduct: m.xmlProduct,
                      matchedProductId: m.matchedProductId,
                      matchedProductName: m.matchedProductName,
                      matchType: m.matchType,
                      expectedQty: m.xmlProduct.quantity,
                      scannedQty: 0,
                      status: "pending" as const,
                    })));
                    goToStep(2);
                  }}
                >
                  🧪 Simular NF e ir para Etapa 2
                </Button>
              </CardContent>
            </Card>
          )}

          {/* XML mode */}
          {nfMode === "xml" && !nfeData && (
            <Card className="border-dashed border-2 border-border/60">
              <CardContent className="p-8 flex flex-col items-center gap-4">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Arraste o arquivo XML da NF-e ou clique para selecionar</p>
                <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleXmlUpload} />
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                  Selecionar XML
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <p className="text-sm font-medium text-muted-foreground">Processando nota fiscal...</p>
            </div>
          )}

          {/* NF Found */}
          {nfeData && !loading && (
            <Card className="border-emerald-500/30">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">XML Encontrado na SEFAZ</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">✓ Autorizada</Badge>
                </div>

                {nfeChave && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Chave NF-e</p>
                    <p className="text-xs font-mono text-muted-foreground break-all">{nfeChave}</p>
                  </div>
                )}

                {matches.length > 0 && (
                  <div className="flex gap-2 text-xs">
                    <Badge variant="secondary">{matches.filter((m) => m.matchType !== "none").length} vinculados</Badge>
                    <Badge variant="destructive">{matches.filter((m) => m.matchType === "none").length} novos</Badge>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => { setNfeData(null); setMatches([]); }}>
                    Trocar nota
                  </Button>
                  {matches.length > 0 ? (
                    <Button className="gap-2" onClick={() => goToStep(2)}>
                      Próximo <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button className="gap-2" onClick={() => goToStep(4)}>
                      Ir para ajustes <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========== STEP 2: CONFERÊNCIA ========== */}
      {currentStep === 2 && (
        <div className="space-y-5">
          {/* Bip Input */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">Bipe ou digite o código de barras...</p>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={bipRef}
                    value={bipInput}
                    onChange={(e) => setBipInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleBip(bipInput); }}
                    placeholder="Bipe ou digite o código de barras..."
                    className="pl-11 min-h-[48px] text-lg font-mono"
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <Button className="h-12" onClick={() => handleBip(bipInput)} disabled={!bipInput.trim()}>
                  Bipar
                </Button>
                <BarcodeScanner onScan={(code) => handleBip(code)} />
              </div>
              {bipAlert && (
                <div className={`rounded-lg p-3 text-sm font-medium flex items-center gap-2 ${
                  bipAlert.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                  bipAlert.type === "warning" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                  "bg-destructive/10 text-destructive border border-destructive/20"
                }`}>
                  {bipAlert.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> :
                   bipAlert.type === "warning" ? <AlertTriangle className="h-4 w-4 shrink-0" /> :
                   <AlertTriangle className="h-4 w-4 shrink-0" />}
                  {bipAlert.msg}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overall progress */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso geral</span>
                <span className="font-bold">{conferenceProgress} de {conferenceItems.length} itens conferidos</span>
              </div>
              <div className="h-3 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${conferenceItems.length > 0 ? (conferenceProgress / conferenceItems.length) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[50px]">Foto</TableHead>
                  <TableHead>Nome do produto</TableHead>
                  <TableHead>SKU / Código</TableHead>
                  <TableHead className="text-center">Qtd Nota</TableHead>
                  <TableHead className="text-center w-[130px]">Qtd Conferida</TableHead>
                  <TableHead className="text-center w-[120px]">Progresso</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conferenceItems.map((item, i) => {
                  const pct = item.expectedQty > 0 ? Math.min(100, (item.scannedQty / item.expectedQty) * 100) : 0;
                  return (
                    <TableRow key={i} className={`transition-all duration-500 ${
                      flashIdx === i ? "!bg-emerald-500/20" :
                      item.status === "ok" ? "bg-emerald-500/5" :
                      item.status === "excess" ? "bg-destructive/5" :
                      item.status === "partial" ? "bg-amber-500/5" : ""
                    }`}>
                      <TableCell>
                        <div className="h-9 w-9 rounded-lg bg-muted/30 flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{item.xmlProduct.description}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{item.xmlProduct.ean || item.xmlProduct.code}</TableCell>
                      <TableCell className="text-center font-medium">{item.expectedQty}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => {
                            setConferenceItems((prev) => {
                              const updated = [...prev];
                              const ci = { ...updated[i], scannedQty: Math.max(0, updated[i].scannedQty - 1) };
                              ci.status = ci.scannedQty === 0 ? "pending" : ci.scannedQty === ci.expectedQty ? "ok" : ci.scannedQty > ci.expectedQty ? "excess" : "partial";
                              updated[i] = ci;
                              return updated;
                            });
                          }}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-bold w-8 text-center text-lg">{item.scannedQty}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => {
                            setConferenceItems((prev) => {
                              const updated = [...prev];
                              const ci = { ...updated[i], scannedQty: updated[i].scannedQty + 1 };
                              ci.status = ci.scannedQty === ci.expectedQty ? "ok" : ci.scannedQty > ci.expectedQty ? "excess" : "partial";
                              updated[i] = ci;
                              return updated;
                            });
                          }}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                item.status === "ok" ? "bg-emerald-500" :
                                item.status === "excess" ? "bg-destructive" :
                                item.status === "partial" ? "bg-amber-500" : "bg-muted-foreground/30"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-8 text-right">{Math.round(pct)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={
                          item.status === "ok" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                          item.status === "excess" ? "bg-destructive/15 text-destructive" :
                          item.status === "partial" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                          "bg-muted text-muted-foreground"
                        }>
                          {item.status === "ok" ? "OK" : item.status === "excess" ? "Divergente" : item.status === "partial" ? "Parcial" : "Pendente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{conferenceProgress} de {conferenceItems.length} itens conferidos</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
              <Button
                onClick={() => {
                  const hasDivergences = conferenceItems.some((i) => i.status !== "ok");
                  goToStep(hasDivergences ? 3 : 4);
                }}
                disabled={conferenceProgress < conferenceItems.length}
              >
                Próximo <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========== STEP 3: DIVERGÊNCIAS ========== */}
      {currentStep === 3 && (
        <div className="space-y-5">
          {divergences.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center space-y-3">
                <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
                <p className="text-lg font-bold">Nenhuma divergência encontrada!</p>
                <p className="text-sm text-muted-foreground">Todos os itens conferem com a nota fiscal.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd Nota</TableHead>
                    <TableHead className="text-center">Qtd Conferida</TableHead>
                    <TableHead className="text-center">Diferença</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {divergences.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{item.xmlProduct.description}</TableCell>
                      <TableCell className="text-center">{item.expectedQty}</TableCell>
                      <TableCell className="text-center">{item.scannedQty}</TableCell>
                      <TableCell className="text-center font-bold text-destructive">
                        {item.scannedQty - item.expectedQty}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant={divergenceActions[i] === "conferida" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setDivergenceActions((p) => ({ ...p, [i]: "conferida" }))}
                          >
                            Aceitar conferida
                          </Button>
                          <Button
                            variant={divergenceActions[i] === "nota" ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setDivergenceActions((p) => ({ ...p, [i]: "nota" }));
                              setConferenceItems((prev) =>
                                prev.map((ci) =>
                                  ci.xmlProduct.code === item.xmlProduct.code
                                    ? { ...ci, scannedQty: ci.expectedQty, status: "ok" }
                                    : ci
                                )
                              );
                            }}
                          >
                            Aceitar da nota
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button onClick={() => goToStep(4)}>
              Próximo <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ========== STEP 4: AJUSTES XML ========== */}
      {currentStep === 4 && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{itemsToShow.length} produto(s)</p>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setNewProductDialog(true)}>
              <Plus className="h-3.5 w-3.5" /> Cadastrar produto
            </Button>
          </div>

          <div className="rounded-xl border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center w-[100px]">Quantidade</TableHead>
                  <TableHead className="text-center w-[130px]">Preço de Custo</TableHead>
                  <TableHead className="text-center w-[130px]">Total</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(adjustedItems.length > 0 ? adjustedItems : matches).map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <p className="text-sm font-medium">{item.xmlProduct.description}</p>
                      <p className="text-xs text-muted-foreground">{item.xmlProduct.ean || item.xmlProduct.code}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        value={item.xmlProduct.quantity}
                        onChange={(e) => updateAdjustedQty(i, parseFloat(e.target.value) || 0)}
                        className="w-20 h-8 text-center mx-auto"
                        min={0}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.xmlProduct.unitValue}
                        onChange={(e) => updateAdjustedCost(i, parseFloat(e.target.value) || 0)}
                        className="w-24 h-8 text-center mx-auto"
                        min={0}
                      />
                    </TableCell>
                    <TableCell className="text-center font-medium text-sm">
                      {formatCurrency(item.xmlProduct.quantity * item.xmlProduct.unitValue)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAdjustedItem(i)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observação geral da entrada</label>
            <Textarea
              value={entryNotes}
              onChange={(e) => setEntryNotes(e.target.value)}
              placeholder="Observações opcionais sobre esta entrada..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(matches.length > 0 ? 3 : 1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button onClick={() => goToStep(5)}>
              Próximo <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ========== STEP 5: CONFIRMAR ========== */}
      {currentStep === 5 && !done && (
        <div className="space-y-5">
          {/* Summary Card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Fornecedor</p>
                  <p className="font-medium mt-1">{nfeData?.issuerName || nfFornecedor}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Número NF</p>
                  <p className="font-medium mt-1">nº {nfeData?.number || nfNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Data</p>
                  <p className="font-medium mt-1">{nfDate ? new Date(nfDate).toLocaleDateString("pt-BR") : nfeData?.issueDate ? new Date(nfeData.issueDate).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Final Table */}
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-center">Custo Unit.</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsToShow.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{item.xmlProduct.description}</TableCell>
                    <TableCell className="text-center">{item.xmlProduct.quantity}</TableCell>
                    <TableCell className="text-center">{formatCurrency(item.xmlProduct.unitValue)}</TableCell>
                    <TableCell className="text-center font-medium">{formatCurrency(item.xmlProduct.totalValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-semibold">Total Geral da Entrada</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(totalValue || nfeData?.totalValue || 0)}</p>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={autoUpdateStock} onCheckedChange={(v) => setAutoUpdateStock(!!v)} />
              <span className="text-sm">Atualizar estoque automaticamente</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={autoUpdateCost} onCheckedChange={(v) => setAutoUpdateCost(!!v)} />
              <span className="text-sm">Atualizar preço de custo dos produtos</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(4)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button
              className="min-h-[48px] px-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={confirmarEntrada}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
              ✓ Confirmar entrada
            </Button>
          </div>
        </div>
      )}

      {/* ========== DONE ========== */}
      {currentStep === 5 && done && (
        <Dialog open={done} onOpenChange={() => {}}>
          <DialogContent className="max-w-md">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-bold">Entrada realizada com sucesso!</p>
                <p className="text-sm text-muted-foreground">
                  {itemsToShow.length} produtos adicionados ao estoque
                </p>
              </div>
            </div>
            <DialogFooter className="flex gap-3 sm:gap-3">
              <Button variant="outline" className="flex-1" onClick={reset}>
                Nova entrada
              </Button>
              <Button className="flex-1" onClick={() => navigate("/estoque")}>
                Ver estoque
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* New Product Dialog */}
      <Dialog open={newProductDialog} onOpenChange={setNewProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome do produto *</label>
              <Input value={newProductData.name} onChange={(e) => setNewProductData((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">SKU *</label>
              <Input value={newProductData.sku} onChange={(e) => setNewProductData((p) => ({ ...p, sku: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">EAN (código de barras)</label>
              <Input value={newProductData.ean} onChange={(e) => setNewProductData((p) => ({ ...p, ean: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Preço de venda</label>
              <Input type="number" value={newProductData.price} onChange={(e) => setNewProductData((p) => ({ ...p, price: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProductDialog(false)}>Cancelar</Button>
            <Button onClick={addNewProduct}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EntradaNota;
