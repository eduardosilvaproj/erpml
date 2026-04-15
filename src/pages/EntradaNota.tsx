import { useState, useCallback, useRef, useEffect } from "react";
import {
  FileText, Loader2, CheckCircle, AlertTriangle, ArrowLeft, ScanBarcode,
  Keyboard, X, Package, ArrowRight, ArrowDown, Bot, Search, Plus, Trash2, Edit2, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const STEP_LABELS = ["NF", "Conferência", "Divergências", "Ajustes", "Confirmar"];

const EntradaNota = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const queryClient = useQueryClient();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1 - NF
  const [nfMode, setNfMode] = useState<"scan" | "manual" | "xml">("scan");
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

  // Step 3 - Divergences
  const [divergences, setDivergences] = useState<ConferenceItem[]>([]);

  // Step 4 - Adjustments
  const [adjustedItems, setAdjustedItems] = useState<MatchResult[]>([]);
  const [newProductDialog, setNewProductDialog] = useState(false);
  const [newProductData, setNewProductData] = useState({ name: "", ean: "", sku: "", price: "" });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Step 5 - Confirm
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

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
      // Build minimal NFeData from chave metadata
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
      // Build conference items from matches
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

  const handleBip = (code: string) => {
    if (!code.trim()) return;
    setBipInput("");
    setBipAlert(null);

    const idx = conferenceItems.findIndex(
      (i) => i.xmlProduct.ean === code || i.xmlProduct.code === code ||
        (i.matchedProductId && i.xmlProduct.ean && i.xmlProduct.ean === code)
    );

    if (idx === -1) {
      // Try matching by barcode from DB
      const dbMatch = conferenceItems.findIndex(
        (i) => i.matchedProductName?.toLowerCase().includes(code.toLowerCase())
      );
      if (dbMatch === -1) {
        setBipAlert({ type: "error", msg: `Produto "${code}" não encontrado na nota!` });
        return;
      }
    }

    const targetIdx = idx !== -1 ? idx : -1;
    if (targetIdx === -1) {
      setBipAlert({ type: "error", msg: `Produto "${code}" não encontrado na nota!` });
      return;
    }

    setConferenceItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[targetIdx] };
      item.scannedQty += 1;

      if (item.scannedQty === item.expectedQty) {
        item.status = "ok";
        setBipAlert({ type: "success", msg: `✓ ${item.xmlProduct.description} — conferido!` });
      } else if (item.scannedQty > item.expectedQty) {
        item.status = "excess";
        setBipAlert({ type: "warning", msg: `⚠ ${item.xmlProduct.description} — excede a quantidade esperada!` });
      } else {
        item.status = "partial";
        setBipAlert({ type: "success", msg: `${item.xmlProduct.description}: ${item.scannedQty}/${item.expectedQty}` });
      }

      updated[targetIdx] = item;
      return updated;
    });
  };

  const conferenceProgress = conferenceItems.length > 0
    ? Math.round((conferenceItems.filter((i) => i.status === "ok").length / conferenceItems.length) * 100)
    : 0;

  const remainingItems = conferenceItems.filter((i) => i.status !== "ok").length;

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

  const updateAdjustedEan = (idx: number, ean: string) => {
    setAdjustedItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, xmlProduct: { ...item.xmlProduct, ean } } : item
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
      // Check duplicate
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

      // Save items and update stock
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
          stock_updated: !!productId,
        });

        if (productId) {
          const { data: current } = await supabase
            .from("products")
            .select("stock_physical, cost")
            .eq("id", productId)
            .single();

          if (current) {
            const qty = Math.floor(match.xmlProduct.quantity);
            const newStock = current.stock_physical + qty;
            const totalOldCost = current.stock_physical * current.cost;
            const totalNewCost = match.xmlProduct.quantity * match.xmlProduct.unitValue;
            const avgCost = newStock > 0 ? (totalOldCost + totalNewCost) / newStock : match.xmlProduct.unitValue;

            await supabase.from("products").update({
              stock_physical: newStock,
              cost: Math.round(avgCost * 100) / 100,
            }).eq("id", productId);
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
    setNfMode("scan");
    setManualKey("");
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
  };

  const canGoToStep = (step: number) => {
    if (step === 1) return true;
    if (step === 2) return !!nfeData && matches.length > 0;
    if (step === 3) return completedSteps.has(2);
    if (step === 4) return completedSteps.has(2);
    if (step === 5) return completedSteps.has(4) || completedSteps.has(3);
    return false;
  };

  const itemsWithoutEan = (adjustedItems.length > 0 ? adjustedItems : matches).filter(
    (m) => !m.xmlProduct.ean
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Entrada de Mercadoria</h1>
          <p className="text-xs text-muted-foreground">Assistente guiado de recebimento</p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-primary border-primary/30">
          <Bot className="h-3.5 w-3.5" />
          Assistente ativo
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as WizardStep;
          const isActive = currentStep === stepNum;
          const isCompleted = completedSteps.has(stepNum);
          const isClickable = canGoToStep(stepNum);

          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <button
                disabled={!isClickable}
                onClick={() => isClickable && goToStep(stepNum)}
                className={`w-full h-2 rounded-full transition-all ${
                  isActive ? "bg-primary" : isCompleted ? "bg-primary/60" : "bg-muted"
                } ${isClickable ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
              />
              <span className={`text-[10px] font-medium ${
                isActive ? "text-primary" : isCompleted ? "text-primary/60" : "text-muted-foreground"
              }`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ========== STEP 1: NF ========== */}
      {currentStep === 1 && (
        <div className="space-y-4">
          {/* AI Assistant Box */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Assistente de Importação</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Digite ou bipe o número da nota. O sistema busca automaticamente e preenche tudo para você.
                  Você também pode importar o XML diretamente.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Mode selector */}
          <div className="flex gap-2">
            {[
              { key: "scan", icon: ScanBarcode, label: "Câmera" },
              { key: "manual", icon: Keyboard, label: "Digitar Chave" },
              { key: "xml", icon: FileText, label: "Importar XML" },
            ].map(({ key, icon: Icon, label }) => (
              <Button
                key={key}
                variant={nfMode === key ? "default" : "outline"}
                className="flex-1 min-h-[48px] gap-2"
                onClick={() => setNfMode(key as any)}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>

          {/* Scan mode */}
          {nfMode === "scan" && !nfeData && (
            <Card className="border-dashed border-2 border-primary/30">
              <CardContent className="p-4 space-y-4">
                <div className="text-center space-y-1">
                  <ScanBarcode className="h-8 w-8 text-primary mx-auto" />
                  <p className="text-sm font-medium">Aponte a câmera para o código de barras do DANFE</p>
                </div>
                <BarcodeScanner onScan={(code) => consultarChave(code)} />
              </CardContent>
            </Card>
          )}

          {/* Manual mode */}
          {nfMode === "manual" && !nfeData && (
            <Card>
              <CardContent className="p-4 space-y-3">
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
                <Button className="w-full min-h-[48px]" onClick={() => consultarChave(manualKey)} disabled={loading || manualKey.replace(/\D/g, "").length < 44}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Buscar Nota
                </Button>
              </CardContent>
            </Card>
          )}

          {/* XML mode */}
          {nfMode === "xml" && !nfeData && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="text-center space-y-2">
                  <FileText className="h-8 w-8 text-primary mx-auto" />
                  <p className="text-sm font-medium">Selecione o arquivo XML da NF-e</p>
                </div>
                <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleXmlUpload} />
                <Button variant="outline" className="w-full min-h-[48px]" onClick={() => fileRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                  Selecionar XML
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {loading && (
            <Card>
              <CardContent className="p-6 flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-medium">Processando nota fiscal...</p>
              </CardContent>
            </Card>
          )}

          {/* NF Preview */}
          {nfeData && !loading && (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold">NF-e nº {nfeData.number}</p>
                    <p className="text-xs text-muted-foreground">Série {nfeData.series}</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200">Autorizada</Badge>
                </div>

                <div className="h-px bg-border" />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Fornecedor</p>
                    <p className="font-medium mt-0.5">{nfeData.issuerName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Data</p>
                    <p className="font-medium mt-0.5">{nfeData.issueDate ? new Date(nfeData.issueDate).toLocaleDateString("pt-BR") : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Itens</p>
                    <p className="font-medium mt-0.5">{nfeData.products.length || matches.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Valor Total</p>
                    <p className="font-medium mt-0.5">{formatCurrency(nfeData.totalValue)}</p>
                  </div>
                </div>

                {matches.length > 0 && (
                  <>
                    <div className="h-px bg-border" />
                    <div className="flex gap-2 text-xs">
                      <Badge variant="secondary">{matches.filter((m) => m.matchType !== "none").length} vinculados</Badge>
                      <Badge variant="destructive">{matches.filter((m) => m.matchType === "none").length} novos</Badge>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => { setNfeData(null); setMatches([]); }}>
                    Trocar nota
                  </Button>
                  {matches.length > 0 ? (
                    <Button className="flex-1 min-h-[48px] gap-2" onClick={() => goToStep(2)}>
                      Ir para conferência
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button className="flex-1 min-h-[48px] gap-2" onClick={() => goToStep(4)}>
                      Ir para ajustes
                      <ArrowRight className="h-4 w-4" />
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
        <div className="space-y-4">
          {/* AI Box */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 flex items-center gap-3">
              <Bot className="h-5 w-5 text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">
                {remainingItems > 0
                  ? `Faltam ${remainingItems} iten(s) para finalizar a conferência.`
                  : "Todos os itens foram conferidos! Pode avançar."}
              </p>
            </CardContent>
          </Card>

          {/* Bip Input */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">Bipe ou digite o código do produto</p>
              <Input
                ref={bipRef}
                value={bipInput}
                onChange={(e) => setBipInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleBip(bipInput);
                  }
                }}
                placeholder="Código de barras / EAN / SKU"
                className="min-h-[52px] text-lg font-mono"
                autoFocus
              />
              {bipAlert && (
                <div className={`rounded-lg p-3 text-sm font-medium ${
                  bipAlert.type === "success" ? "bg-emerald-500/10 text-emerald-700" :
                  bipAlert.type === "warning" ? "bg-amber-500/10 text-amber-700" :
                  "bg-destructive/10 text-destructive"
                }`}>
                  {bipAlert.msg}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${conferenceProgress}%` }} />
            </div>
            <span className="text-sm font-medium text-muted-foreground">{conferenceProgress}%</span>
          </div>

          {/* Items List */}
          <div className="space-y-2">
            {conferenceItems.map((item, i) => (
              <Card key={i} className={`border ${
                item.status === "ok" ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-500/5" :
                item.status === "excess" ? "border-destructive/30 bg-destructive/5" :
                item.status === "partial" ? "border-amber-200 bg-amber-50/50 dark:bg-amber-500/5" :
                "border-border"
              }`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    item.status === "ok" ? "bg-emerald-500/15 text-emerald-700" :
                    item.status === "excess" ? "bg-destructive/15 text-destructive" :
                    item.status === "partial" ? "bg-amber-500/15 text-amber-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {item.status === "ok" ? <CheckCircle className="h-4 w-4" /> :
                     item.status === "excess" ? <AlertTriangle className="h-4 w-4" /> :
                     `${item.scannedQty}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.xmlProduct.description}</p>
                    <p className="text-xs text-muted-foreground">
                      EAN: {item.xmlProduct.ean || "—"} • Esperado: {item.expectedQty} • Conferido: {item.scannedQty}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => setCurrentStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button className="flex-1 min-h-[48px] gap-2" onClick={() => {
              const hasDivergences = conferenceItems.some((i) => i.status !== "ok");
              goToStep(hasDivergences ? 3 : 4);
            }}>
              Avançar
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ========== STEP 3: DIVERGÊNCIAS ========== */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <Card className="border-amber-200 bg-amber-500/5">
            <CardContent className="p-3 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {divergences.length > 0
                  ? `${divergences.length} divergência(s) encontrada(s). Revise antes de continuar.`
                  : "Nenhuma divergência encontrada!"}
              </p>
            </CardContent>
          </Card>

          {divergences.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                <p className="text-sm font-medium">Tudo certo! Nenhuma divergência.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {divergences.map((item, i) => (
                <Card key={i} className="border-amber-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{item.xmlProduct.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Esperado: {item.expectedQty} | Conferido: {item.scannedQty} | Diferença: {item.expectedQty - item.scannedQty}
                        </p>
                      </div>
                      <Badge className={
                        item.status === "excess" ? "bg-destructive/15 text-destructive" :
                        item.status === "pending" ? "bg-muted text-muted-foreground" :
                        "bg-amber-500/15 text-amber-700"
                      }>
                        {item.status === "excess" ? "Excesso" : item.status === "pending" ? "Não conferido" : "Parcial"}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                        setConferenceItems((prev) =>
                          prev.map((ci) =>
                            ci.xmlProduct.code === item.xmlProduct.code
                              ? { ...ci, scannedQty: ci.expectedQty, status: "ok" }
                              : ci
                          )
                        );
                        setDivergences((prev) => prev.filter((_, idx) => idx !== i));
                        toast({ title: "Ajustado manualmente" });
                      }}>
                        Ajustar para esperado
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1" onClick={() => {
                        setDivergences((prev) => prev.filter((_, idx) => idx !== i));
                        toast({ title: "Divergência ignorada" });
                      }}>
                        Ignorar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button className="flex-1 min-h-[48px] gap-2" onClick={() => goToStep(4)}>
              Avançar para ajustes
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ========== STEP 4: AJUSTES XML ========== */}
      {currentStep === 4 && (
        <div className="space-y-4">
          {/* EAN warning */}
          {itemsWithoutEan.length > 0 && (
            <Card className="border-amber-200 bg-amber-500/5">
              <CardContent className="p-3 flex items-center gap-3">
                <Bot className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Detectamos {itemsWithoutEan.length} produto(s) sem código de barras. Preencha o EAN ou cadastre novos produtos.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between items-center">
            <p className="text-sm font-medium">{(adjustedItems.length > 0 ? adjustedItems : matches).length} produto(s)</p>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setNewProductDialog(true)}>
              <Plus className="h-3.5 w-3.5" />
              Cadastrar produto
            </Button>
          </div>

          <div className="space-y-2">
            {(adjustedItems.length > 0 ? adjustedItems : matches).map((item, i) => (
              <Card key={i}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.xmlProduct.description}</p>
                      <div className="flex gap-2 mt-1">
                        {item.matchType !== "none" && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 text-[10px]">
                            Vinculado
                          </Badge>
                        )}
                        {!item.xmlProduct.ean && (
                          <Badge variant="destructive" className="text-[10px]">Sem EAN</Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeAdjustedItem(i)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Qtd</p>
                      <Input
                        type="number"
                        value={item.xmlProduct.quantity}
                        onChange={(e) => updateAdjustedQty(i, parseFloat(e.target.value) || 0)}
                        className="h-9 text-sm"
                        min={0}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Valor Unit.</p>
                      <Input value={formatCurrency(item.xmlProduct.unitValue)} className="h-9 text-sm" readOnly />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">EAN</p>
                      <Input
                        value={item.xmlProduct.ean}
                        onChange={(e) => updateAdjustedEan(i, e.target.value)}
                        placeholder="Preencher"
                        className={`h-9 text-sm ${!item.xmlProduct.ean ? "border-amber-400" : ""}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => setCurrentStep(matches.length > 0 ? 3 : 1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button className="flex-1 min-h-[48px] gap-2" onClick={() => goToStep(5)}>
              Avançar para confirmação
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ========== STEP 5: CONFIRMAR ========== */}
      {currentStep === 5 && !done && (
        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardContent className="p-5 space-y-4">
              <div className="text-center space-y-2">
                <Package className="h-12 w-12 text-primary mx-auto" />
                <p className="text-base font-bold">Confirmar Entrada no Estoque</p>
              </div>

              <div className="h-px bg-border" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Fornecedor</p>
                  <p className="font-medium mt-0.5">{nfeData?.issuerName}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">NF-e</p>
                  <p className="font-medium mt-0.5">nº {nfeData?.number}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Produtos</p>
                  <p className="font-medium mt-0.5">{(adjustedItems.length > 0 ? adjustedItems : matches).length}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Valor Total</p>
                  <p className="font-medium mt-0.5">{formatCurrency(nfeData?.totalValue || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
              <p>✔ Estoque físico será atualizado automaticamente</p>
              <p>✔ Entrada será registrada no histórico</p>
              <p>✔ Custo médio será recalculado</p>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => setCurrentStep(4)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button className="flex-1 min-h-[52px] gap-2 text-base" onClick={confirmarEntrada} disabled={saving}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
              Confirmar entrada
            </Button>
          </div>
        </div>
      )}

      {/* ========== DONE ========== */}
      {currentStep === 5 && done && (
        <div className="space-y-4">
          <Card className="border-emerald-200 bg-emerald-500/5">
            <CardContent className="p-8 flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-bold text-emerald-700">Entrada confirmada!</p>
                <p className="text-sm text-muted-foreground">
                  NF-e nº {nfeData?.number} — {(adjustedItems.length > 0 ? adjustedItems : matches).length} produto(s) atualizados no estoque.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={reset}>
              Nova entrada
            </Button>
            <Button className="flex-1 min-h-[48px]" onClick={() => navigate("/entrada-xml")}>
              Ver todas as notas
            </Button>
          </div>
        </div>
      )}

      {/* New Product Dialog */}
      <Dialog open={newProductDialog} onOpenChange={setNewProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Nome do produto *</p>
              <Input value={newProductData.name} onChange={(e) => setNewProductData((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">SKU *</p>
              <Input value={newProductData.sku} onChange={(e) => setNewProductData((p) => ({ ...p, sku: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">EAN (código de barras)</p>
              <Input value={newProductData.ean} onChange={(e) => setNewProductData((p) => ({ ...p, ean: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Preço de venda</p>
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
