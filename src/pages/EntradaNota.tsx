import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  FileText, Loader2, CheckCircle, AlertTriangle, ArrowLeft, ScanBarcode,
  Keyboard, Package, ArrowRight, Bot, Search, Plus, Minus, Trash2, Check,
  Upload, Files, XCircle, ChevronLeft, ChevronRight, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/BarcodeScannerInput";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQueryClient } from "@tanstack/react-query";
import { parseNFeXml, matchProducts, type NFeData, type MatchResult, type NFeProduct } from "@/lib/nfe-parser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { EntradaNotaHistorico } from "@/components/EntradaNotaHistorico";

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface ConferenceItem {
  xmlProduct: NFeProduct;
  matchedProductId: string | null;
  matchedProductName: string | null;
  matchedProductBarcode: string | null;
  matchedProductSku: string | null;
  matchedProductGtinCx: string | null;
  matchedProductBoxQty: number | null;
  matchType: string;
  expectedQty: number;
  scannedQty: number;
  status: "pending" | "partial" | "ok" | "excess" | "not_found";
  nfNumber?: string;
  boxBadge?: string;
}


// Batch mode types
interface BatchNfe {
  id: string;
  nfeData: NFeData;
  matches: MatchResult[];
  fileName?: string;
  selected: boolean;
  conferenceStatus: "pending" | "in_progress" | "done";
  partialData?: boolean;
  partialReason?: string;
}

interface SefazEntry {
  id: string;
  number: string;
  series: string;
  status: "idle" | "loading" | "found" | "error";
  error?: string;
  nfeData?: NFeData;
  matches?: MatchResult[];
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

  // Step 1 - NFs loaded
  const [batchNfes, setBatchNfes] = useState<BatchNfe[]>([]);
  const [sefazEntries, setSefazEntries] = useState<SefazEntry[]>([{ id: `init-${Date.now()}`, number: "", series: "001", status: "idle" }]);
  const [batchSearching, setBatchSearching] = useState(false);
  const [batchSearchProgress, setBatchSearchProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const batchFileRef = useRef<HTMLInputElement>(null);

  // Mode: auto-detected based on loaded NFs count
  const isBatchMode = batchNfes.length > 1;
  
  // Step 2 - Conference
  const [conferenceItems, setConferenceItems] = useState<ConferenceItem[]>([]);
  const [bipInput, setBipInput] = useState("");
  const bipRef = useRef<BarcodeScannerInputHandle>(null);
  const [bipAlert, setBipAlert] = useState<{ type: "success" | "warning" | "error"; msg: string } | null>(null);
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [batchConferenceMode, setBatchConferenceMode] = useState<"together" | "one_by_one" | null>(null);
  const [currentBatchNfIdx, setCurrentBatchNfIdx] = useState(0);

  const [boxBipDialog, setBoxBipDialog] = useState<{ code: string; productIdx?: number; productName?: string; qtyPerBox?: number } | null>(null);
  const [unknownGtinDialog, setUnknownGtinDialog] = useState<{ code: string } | null>(null);
  const [unknownGtinProduct, setUnknownGtinProduct] = useState("");
  const [unknownGtinQty, setUnknownGtinQty] = useState(1);
  const [unknownGtinBoxes, setUnknownGtinBoxes] = useState(1);
  const [unknownGtinSave, setUnknownGtinSave] = useState(true);

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
  const [batchSelectedForConfirm, setBatchSelectedForConfirm] = useState<Set<string>>(new Set());
  const [batchConfirmResult, setBatchConfirmResult] = useState<{ confirmed: number; products: number; total: number } | null>(null);

  // ============ LOCALSTORAGE PERSISTENCE ============
  const STORAGE_KEY = "entrada_nota_wizard_state";

  useEffect(() => {
    if (done || (currentStep === 1 && conferenceItems.length === 0 && batchNfes.length === 0)) return;
    try {
      const stateToSave = {
        currentStep,
        completedSteps: Array.from(completedSteps),
        conferenceItems,
        batchNfes,
        batchConferenceMode,
        currentBatchNfIdx,
        divergences,
        divergenceActions,
        adjustedItems,
        entryNotes,
        autoUpdateStock,
        autoUpdateCost,
        nfMode,
        nfeChave,
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {}
  }, [currentStep, completedSteps, conferenceItems, batchNfes, batchConferenceMode, currentBatchNfIdx, divergences, divergenceActions, adjustedItems, entryNotes, autoUpdateStock, autoUpdateCost, done, nfMode, nfeChave]);

  const [hasRestoredState, setHasRestoredState] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);

  useEffect(() => {
    if (hasRestoredState) return;
    setHasRestoredState(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.savedAt && Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000 && (parsed.conferenceItems?.length > 0 || parsed.batchNfes?.length > 0)) {
        setShowRestoreDialog(true);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, [hasRestoredState]);

  const restoreSavedState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const s = JSON.parse(saved);
      if (s.currentStep) setCurrentStep(s.currentStep);
      if (s.completedSteps) setCompletedSteps(new Set(s.completedSteps));
      if (s.conferenceItems) setConferenceItems(s.conferenceItems);
      if (s.batchNfes) setBatchNfes(s.batchNfes);
      if (s.batchConferenceMode) setBatchConferenceMode(s.batchConferenceMode);
      if (s.currentBatchNfIdx != null) setCurrentBatchNfIdx(s.currentBatchNfIdx);
      if (s.divergences) setDivergences(s.divergences);
      if (s.divergenceActions) setDivergenceActions(s.divergenceActions);
      if (s.adjustedItems) setAdjustedItems(s.adjustedItems);
      if (s.entryNotes) setEntryNotes(s.entryNotes);
      if (s.autoUpdateStock != null) setAutoUpdateStock(s.autoUpdateStock);
      if (s.autoUpdateCost != null) setAutoUpdateCost(s.autoUpdateCost);
      if (s.nfMode) setNfMode(s.nfMode);
      if (s.nfeChave) setNfeChave(s.nfeChave);
      toast({ title: "Progresso restaurado!", description: "Continuando de onde você parou." });
    } catch {}
    setShowRestoreDialog(false);
  };

  const discardSavedState = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShowRestoreDialog(false);
  };

  const clearPersistedState = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const normalizeDigits = (value: string) => value.replace(/\D/g, "");
  const normalizeIdentifier = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  const fetchProductsForMatching = useCallback(async () => {
    if (!companyId) {
      throw new Error("Aguarde o carregamento da empresa antes de buscar a nota.");
    }

    const { data, error } = await supabase
      .from("products")
      .select("id, name, barcode, sku, gtin_cx, box_quantity")
      .eq("company_id", companyId)
      .order("name");

    if (error) {
      throw new Error("Não foi possível carregar os produtos cadastrados da empresa.");
    }

    return data || [];
  }, [companyId]);

  // ============ BATCH MODE FUNCTIONS ============
  const handleBatchXmlUpload = useCallback(async (files: FileList | File[]) => {
    const xmlFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".xml"));
    if (xmlFiles.length === 0) {
      toast({ title: "Nenhum XML", description: "Selecione arquivos XML válidos.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const dbProducts = await fetchProductsForMatching();

      if (dbProducts.length === 0) {
        toast({
          title: "Nenhum produto cadastrado",
          description: "Os itens da nota serão importados como novos até que o catálogo da empresa seja preenchido.",
        });
      }

      for (const file of xmlFiles) {
        try {
          const xml = await file.text();
          const parsed = parseNFeXml(xml);
          const matched = matchProducts(parsed.products, dbProducts);
          setBatchNfes((prev) => [
            ...prev,
            {
              id: generateId(),
              nfeData: parsed,
              matches: matched,
              fileName: file.name,
              selected: true,
              conferenceStatus: "pending",
            },
          ]);
        } catch (err: any) {
          toast({ title: `Erro: ${file.name}`, description: err.message, variant: "destructive" });
        }
      }
    } catch (err: any) {
      toast({ title: "Erro ao carregar catálogo", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [fetchProductsForMatching, toast]);

  const handleBatchDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleBatchXmlUpload(e.dataTransfer.files);
  };

  const addSefazEntry = () => {
    if (sefazEntries.length >= 20) {
      toast({ title: "Limite atingido", description: "Máximo de 20 NFs por lote.", variant: "destructive" });
      return;
    }
    setSefazEntries((prev) => [...prev, { id: generateId(), number: "", series: "001", status: "idle" }]);
  };

  const removeSefazEntry = (id: string) => {
    setSefazEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const updateSefazEntry = (id: string, field: "number" | "series", value: string) => {
    setSefazEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const removeBatchNfe = (id: string) => {
    setBatchNfes((prev) => prev.filter((n) => n.id !== id));
  };

  const toggleBatchNfe = (id: string) => {
    setBatchNfes((prev) => prev.map((n) => (n.id === id ? { ...n, selected: !n.selected } : n)));
  };

  const toggleAllBatchNfes = () => {
    const allSelected = batchNfes.every((n) => n.selected);
    setBatchNfes((prev) => prev.map((n) => ({ ...n, selected: !allSelected })));
  };

  const selectedBatchNfes = useMemo(() => batchNfes.filter((n) => n.selected), [batchNfes]);

  const batchTotalItems = useMemo(
    () => selectedBatchNfes.reduce((sum, n) => sum + n.nfeData.products.length, 0),
    [selectedBatchNfes]
  );

  const batchTotalValue = useMemo(
    () => selectedBatchNfes.reduce((sum, n) => sum + n.nfeData.totalValue, 0),
    [selectedBatchNfes]
  );

  // ============ STEP NAVIGATION ============
  const goToStep = (step: WizardStep) => {
    if (step === 2) {
      if (isBatchMode && selectedBatchNfes.length > 0) {
        const batchWithItems = selectedBatchNfes.filter((n) => n.nfeData.products.length > 0);
        if (batchWithItems.length === 0) {
          toast({
            title: "Notas sem itens para conferência",
            description: "As notas buscadas apenas pela chave retornam somente o cabeçalho. Importe o XML para conferir os produtos.",
            variant: "destructive",
          });
          return;
        }
        if (batchWithItems.length !== selectedBatchNfes.length) {
          setBatchNfes((prev) => prev.map((n) => n.selected ? { ...n, selected: n.nfeData.products.length > 0 } : n));
          toast({
            title: "Notas sem itens foram desmarcadas",
            description: "Somente notas com produtos importados seguirão para a conferência.",
          });
        }
        setBatchConferenceMode(null);
        setCompletedSteps((p) => new Set([...p, 1]));
      } else if (batchNfes.length === 1) {
        const singleNf = batchNfes[0];
        if (singleNf.nfeData.products.length === 0) {
          toast({
            title: "NF sem itens para conferência",
            description: "A consulta por chave retorna apenas dados do cabeçalho. Importe o XML para carregar os produtos.",
            variant: "destructive",
          });
          return;
        }
        const items: ConferenceItem[] = singleNf.matches.map((m) => ({
          xmlProduct: m.xmlProduct,
          matchedProductId: m.matchedProductId,
          matchedProductName: m.matchedProductName,
          matchedProductBarcode: m.matchedProductBarcode,
          matchedProductSku: m.matchedProductSku,
          matchedProductGtinCx: null,
          matchedProductBoxQty: null,
          matchType: m.matchType,
          expectedQty: Math.floor(m.xmlProduct.quantity),
          scannedQty: 0,
          status: "pending",
        }));
        setConferenceItems(items);
        setNfeData(singleNf.nfeData);
        setMatches(singleNf.matches);
        setCompletedSteps((p) => new Set([...p, 1]));
      }
    }
    if (step === 3) {
      const divs = conferenceItems.filter((i) => i.status !== "ok");
      setDivergences(divs);
      setDivergenceActions({});
      setCompletedSteps((p) => new Set([...p, 2]));
    }
    if (step === 4) {
      if (isBatchMode) {
        const allMatches: MatchResult[] = selectedBatchNfes.flatMap((n) => n.matches);
        setAdjustedItems([...allMatches]);
      } else {
        setAdjustedItems([...matches]);
      }
      setCompletedSteps((p) => new Set([...p, 3]));
    }
    if (step === 5) {
      setCompletedSteps((p) => new Set([...p, 4]));
      if (isBatchMode) {
        setBatchSelectedForConfirm(new Set(selectedBatchNfes.map((n) => n.id)));
      }
    }
    setCurrentStep(step);
  };

  const startBatchConference = (mode: "together" | "one_by_one") => {
    setBatchConferenceMode(mode);
    setCurrentBatchNfIdx(0);

    if (mode === "together") {
      const items: ConferenceItem[] = selectedBatchNfes.flatMap((n) =>
        n.matches.map((m) => ({
          xmlProduct: m.xmlProduct,
          matchedProductId: m.matchedProductId,
          matchedProductName: m.matchedProductName,
          matchedProductBarcode: m.matchedProductBarcode,
          matchedProductSku: m.matchedProductSku,
          matchedProductGtinCx: null,
          matchedProductBoxQty: null,
          matchType: m.matchType,
          expectedQty: Math.floor(m.xmlProduct.quantity),
          scannedQty: 0,
          status: "pending" as const,
          nfNumber: n.nfeData.number,
        }))
      );
      setConferenceItems(items);
    } else {
      // one by one: load first NF
      loadNfConference(0);
    }
  };

  const loadNfConference = (idx: number) => {
    const nf = selectedBatchNfes[idx];
    if (!nf) return;
    const items: ConferenceItem[] = nf.matches.map((m) => ({
      xmlProduct: m.xmlProduct,
      matchedProductId: m.matchedProductId,
      matchedProductName: m.matchedProductName,
      matchedProductBarcode: m.matchedProductBarcode,
      matchedProductSku: m.matchedProductSku,
      matchedProductGtinCx: null,
      matchedProductBoxQty: null,
      matchType: m.matchType,
      expectedQty: Math.floor(m.xmlProduct.quantity),
      scannedQty: 0,
      status: "pending" as const,
      nfNumber: nf.nfeData.number,
    }));
    setConferenceItems(items);
    setCurrentBatchNfIdx(idx);
  };

  const finishCurrentNfConference = () => {
    setBatchNfes((prev) =>
      prev.map((n, i) => {
        if (n.id === selectedBatchNfes[currentBatchNfIdx]?.id) {
          return { ...n, conferenceStatus: "done" };
        }
        return n;
      })
    );
    if (currentBatchNfIdx < selectedBatchNfes.length - 1) {
      loadNfConference(currentBatchNfIdx + 1);
    }
  };

  const batchConferenceDoneCount = useMemo(
    () => batchNfes.filter((n) => n.selected && n.conferenceStatus === "done").length,
    [batchNfes]
  );

  // ========== STEP 2: CONFERENCE (BIP) ==========
  useEffect(() => {
    if (currentStep === 2 && bipRef.current && (batchConferenceMode || !isBatchMode)) {
      bipRef.current.focus();
    }
  }, [currentStep, batchConferenceMode, isBatchMode]);

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

  const handleBip = async (code: string) => {
    if (!code.trim()) return;
    setBipInput("");
    setBipAlert(null);

    const normalizedDigits = normalizeDigits(code);
    const normalizedCode = normalizeIdentifier(code);

    const idx = conferenceItems.findIndex(
      (i) => {
        const eanMatch = normalizedDigits.length > 0 && normalizeDigits(i.xmlProduct.ean) === normalizedDigits;
        const codeMatch = normalizeIdentifier(i.xmlProduct.code) === normalizedCode;
        // Also match against linked product's barcode/SKU from the database
        const dbBarcodeMatch = normalizedDigits.length > 0 && i.matchedProductBarcode && normalizeDigits(i.matchedProductBarcode) === normalizedDigits;
        const dbSkuMatch = i.matchedProductSku && normalizeIdentifier(i.matchedProductSku) === normalizedCode;
        return eanMatch || codeMatch || dbBarcodeMatch || dbSkuMatch;
      }
    );

    if (idx !== -1) {
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
          bipRef.current?.flash(true);
        } else if (item.scannedQty > item.expectedQty) {
          item.status = "excess";
          setBipAlert({ type: "warning", msg: `⚠ ${item.xmlProduct.description} — excede a quantidade esperada!` });
          playBeep(200, 150);
          setTimeout(() => playBeep(200, 150), 200);
          bipRef.current?.flash(false);
        } else {
          item.status = "partial";
          setBipAlert({ type: "success", msg: `${item.xmlProduct.description}: ${item.scannedQty}/${item.expectedQty}` });
          playBeep(600, 100);
          bipRef.current?.flash(true);
        }
        updated[idx] = item;
        return updated;
      });
      setTimeout(() => bipRef.current?.focus(), 50);
      return;
    }

    // Check GTIN CX (always, not just box mode) — strict match by company
    // Always show selection modal for confirmation, pre-selecting matched product as suggestion
    let preSelectedProduct = "";
    let preSelectedQty = 1;
    let isKnownGtin = false;

    try {
      const gtinCandidates = Array.from(new Set([code.trim(), normalizedDigits].filter(Boolean)));
      const { data: boxProducts } = await supabase
        .from("products")
        .select("id, name, gtin_cx, box_quantity")
        .eq("company_id", companyId)
        .in("gtin_cx", gtinCandidates);

      if (boxProducts && boxProducts.length > 0) {
        isKnownGtin = true;
        // Pre-select the exact product that is in the conference list (using idx- key)
        for (const bp of boxProducts) {
          const productIdx = conferenceItems.findIndex((i) => i.matchedProductId === bp.id);
          if (productIdx !== -1) {
            preSelectedProduct = `idx-${productIdx}`;
            preSelectedQty = bp.box_quantity || 1;
            break;
          }
        }
        // Fallback: find first conference item index for first box product
        if (!preSelectedProduct && boxProducts[0]) {
          const fallbackIdx = conferenceItems.findIndex((i) => i.matchedProductId === boxProducts[0].id);
          if (fallbackIdx !== -1) {
            preSelectedProduct = `idx-${fallbackIdx}`;
          }
          preSelectedQty = boxProducts[0].box_quantity || 1;
        }
      }
    } catch { /* fall through */ }

    // Open selection modal — pre-select matched product for known GTINs
    setUnknownGtinDialog({ code });
    setUnknownGtinProduct(preSelectedProduct);
    setUnknownGtinQty(preSelectedQty);
    setUnknownGtinBoxes(1);
    setUnknownGtinSave(!isKnownGtin);
    playBeep(isKnownGtin ? 600 : 200, isKnownGtin ? 100 : 400);
    return;
  };

  const applyBoxBip = (productIdx: number, boxes: number, qtyPerBox: number) => {
    const total = boxes * qtyPerBox;
    setConferenceItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[productIdx] };
      item.scannedQty += total;
      item.boxBadge = `📦 ${boxes} cx × ${qtyPerBox} un = ${total}`;
      if (item.scannedQty === item.expectedQty) item.status = "ok";
      else if (item.scannedQty > item.expectedQty) item.status = "excess";
      else item.status = "partial";
      updated[productIdx] = item;
      return updated;
    });
    setBoxBipDialog(null);
    playBeep(800, 100);
    setBipAlert({ type: "success", msg: `📦 ${total} unidades adicionadas via caixa!` });
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
    if (isBatchMode) {
      await confirmarEntradaLote();
      return;
    }
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
      clearPersistedState();
      toast({ title: "Entrada confirmada!", description: "Estoque atualizado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro ao confirmar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmarEntradaLote = async () => {
    setSaving(true);
    let confirmed = 0;
    let totalProducts = 0;
    let totalVal = 0;

    try {
      const nfesToConfirm = selectedBatchNfes.filter((n) => batchSelectedForConfirm.has(n.id));

      for (const nf of nfesToConfirm) {
        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("number", nf.nfeData.number)
          .eq("issuer_cnpj", nf.nfeData.issuerCnpj)
          .eq("company_id", companyId)
          .maybeSingle();

        if (existing) continue;

        const { data: invoice, error: invError } = await supabase
          .from("invoices")
          .insert({
            number: nf.nfeData.number,
            series: nf.nfeData.series,
            issuer_cnpj: nf.nfeData.issuerCnpj,
            issuer_name: nf.nfeData.issuerName,
            total_value: nf.nfeData.totalValue,
            status: "conferida",
            items_count: nf.matches.length,
            company_id: companyId,
          })
          .select()
          .single();

        if (invError) continue;

        for (const match of nf.matches) {
          const productId = match.matchedProductId;

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
                await supabase.from("products").update({ stock_physical: newStock, cost: Math.round(avgCost * 100) / 100 }).eq("id", productId);
              } else {
                await supabase.from("products").update({ stock_physical: newStock }).eq("id", productId);
              }
            }
          }

          totalProducts++;
        }

        confirmed++;
        totalVal += nf.nfeData.totalValue;
      }

      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });

      setBatchConfirmResult({ confirmed, products: totalProducts, total: totalVal });
      setDone(true);
      clearPersistedState();
      toast({ title: `${confirmed} nota(s) confirmada(s)!` });
    } catch (err: any) {
      toast({ title: "Erro ao confirmar lote", description: err.message, variant: "destructive" });
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
    setBatchNfes([]);
    setSefazEntries([{ id: `init-${Date.now()}`, number: "", series: "001", status: "idle" }]);
    setBatchConferenceMode(null);
    setCurrentBatchNfIdx(0);
    setBatchSelectedForConfirm(new Set());
    setBatchConfirmResult(null);
    setBoxBipDialog(null);
    setUnknownGtinDialog(null);
    clearPersistedState();
  };

  const canGoToStep = (step: number) => {
    if (step === 1) return true;
    if (step === 2) {
      return batchNfes.length > 0 && (isBatchMode ? selectedBatchNfes.length > 0 : batchNfes[0]?.matches?.length > 0);
    }
    if (step === 3) return completedSteps.has(2);
    if (step === 4) return completedSteps.has(2);
    if (step === 5) return completedSteps.has(4) || completedSteps.has(3);
    return false;
  };

  const itemsToShow = adjustedItems.length > 0 ? adjustedItems : (isBatchMode ? selectedBatchNfes.flatMap((n) => n.matches) : matches);
  const totalValue = itemsToShow.reduce((sum, m) => sum + m.xmlProduct.totalValue, 0);

  // ========== RENDER ==========
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Entrada de Mercadoria</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Passo {currentStep} — {STEP_LABELS[currentStep - 1]}
          </p>
        </div>
        
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

      {/* ========== STEP 1: NF (unified) ========== */}
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
                Importe uma ou várias notas. O sistema detecta automaticamente se é entrada única ou em lote.
              </p>
            </div>
          </div>

          {/* Mode Toggle: SEFAZ vs XML */}
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
          {nfMode === "sefaz" && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <p className="text-sm font-medium">Chave de Acesso (44 dígitos)</p>
                {sefazEntries.map((entry, idx) => (
                  <div key={entry.id} className="flex items-center gap-2">
                    <div className="flex-1">
                      <BarcodeScannerInput
                        value={entry.number}
                        onChange={(v) => updateSefazEntry(entry.id, "number", v)}
                        onScan={(code) => updateSefazEntry(entry.id, "number", code)}
                        placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                        inputClassName="min-h-[48px] text-base font-mono tracking-wider"
                        maxLength={54}
                        inputMode="numeric"
                        showCameraButton
                      />
                      <p className="text-xs text-muted-foreground mt-1">{entry.number.replace(/\D/g, "").length}/44 dígitos</p>
                    </div>
                    <div className="w-20">
                      <Input
                        placeholder="Série"
                        value={entry.series}
                        onChange={(e) => updateSefazEntry(entry.id, "series", e.target.value)}
                        className="min-h-[48px]"
                      />
                    </div>
                    {sefazEntries.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => removeSefazEntry(entry.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="gap-2 min-h-[44px]"
                    onClick={addSefazEntry}
                    disabled={sefazEntries.length >= 20}
                  >
                    <Plus className="h-4 w-4" /> Adicionar outra NF
                  </Button>
                  <Button
                    className="flex-1 min-h-[44px]"
                    onClick={async () => {
                      const validEntries = sefazEntries.filter((e) => e.number.replace(/\D/g, "").length === 44);
                      if (validEntries.length === 0) {
                        toast({ title: "Preencha pelo menos uma chave válida", description: "A chave deve ter 44 dígitos.", variant: "destructive" });
                        return;
                      }
                      setLoading(true);
                      setBatchSearchProgress({ current: 0, total: validEntries.length });

                      try {
                        const dbProducts = await fetchProductsForMatching();

                        if (dbProducts.length === 0) {
                          toast({
                            title: "Nenhum produto cadastrado",
                            description: "A nota será carregada, mas os itens serão marcados como novos até que exista um catálogo na empresa.",
                          });
                        }

                        let processed = 0;
                        for (const entry of validEntries) {
                          try {
                            const clean = normalizeDigits(entry.number);
                            const { data, error } = await supabase.functions.invoke("nfe-consulta", { body: { chave: clean } });
                            if (error || data?.error) throw new Error(data?.error || error?.message);
                            const products = Array.isArray(data?.products) ? data.products : [];
                            const nfe: NFeData = {
                              number: data.numero,
                              series: data.serie,
                              issuerName: `Emitente ${data.cnpjFormatado} (${data.uf})`,
                              issuerCnpj: data.cnpjEmitente,
                              totalValue: typeof data.totalValue === "number" ? data.totalValue : 0,
                              issueDate: data.dataEmissao,
                              products,
                            };
                            const matchResults = products.length > 0 ? matchProducts(products, dbProducts) : [];
                            if (validEntries.length === 1) {
                              setNfeData(nfe);
                              setMatches(matchResults);
                              setNfNumber(data.numero);
                              setNfSeries(data.serie || "001");
                              setNfFornecedor(nfe.issuerName);
                              setNfDate(data.dataEmissao || "");
                              setNfeChave(clean);
                            }
                            setBatchNfes((prev) => [...prev, {
                              id: generateId(),
                              nfeData: nfe,
                              matches: matchResults,
                              selected: true,
                              conferenceStatus: "pending",
                              partialData: Boolean(data?.partialData),
                              partialReason: typeof data?.partialReason === "string" ? data.partialReason : undefined,
                            }]);
                          } catch (err: any) {
                            toast({ title: `Erro na NF`, description: err.message, variant: "destructive" });
                          }
                          processed++;
                          setBatchSearchProgress({ current: processed, total: validEntries.length });
                        }
                      } catch (err: any) {
                        toast({ title: "Erro ao carregar catálogo", description: err.message, variant: "destructive" });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading || sefazEntries.every((e) => e.number.replace(/\D/g, "").length < 44)}
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    {loading ? `Buscando ${batchSearchProgress.current} de ${batchSearchProgress.total}...` : "Buscar na SEFAZ"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* XML mode */}
          {nfMode === "xml" && (
            <Card className="border-dashed border-2 border-border/60">
              <CardContent className="p-8">
                <div
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 transition-colors ${
                    dragOver ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleBatchDrop}
                >
                  <Upload className={`mb-3 h-10 w-10 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground/40"}`} />
                  <p className="text-sm font-medium mb-1">Arraste um ou vários XMLs aqui</p>
                  <p className="text-xs text-muted-foreground mb-4">Suporta seleção múltipla de arquivos</p>
                  <input
                    ref={batchFileRef}
                    type="file"
                    accept=".xml"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files) handleBatchXmlUpload(e.target.files); if (batchFileRef.current) batchFileRef.current.value = ""; }}
                  />
                  <Button variant="outline" onClick={() => batchFileRef.current?.click()} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Selecionar XML(s)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <p className="text-sm font-medium text-muted-foreground">Processando nota(s) fiscal(is)...</p>
            </div>
          )}

          {/* Single NF loaded — go straight to next step */}
          {batchNfes.length === 1 && !loading && (
            <Card className={batchNfes[0].nfeData.products.length > 0 ? "border-emerald-500/30" : "border-amber-500/30"}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${batchNfes[0].nfeData.products.length > 0 ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
                    {batchNfes[0].nfeData.products.length > 0
                      ? <CheckCircle className="h-5 w-5 text-emerald-500" />
                      : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">NF-e nº {batchNfes[0].nfeData.number}</p>
                    <p className="text-xs text-muted-foreground">{batchNfes[0].nfeData.issuerName}</p>
                  </div>
                  <Badge className={batchNfes[0].nfeData.products.length > 0
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"}>
                    {batchNfes[0].nfeData.products.length} itens — {formatCurrency(batchNfes[0].nfeData.totalValue)}
                  </Badge>
                </div>
                {batchNfes[0].nfeData.products.length === 0 && (
                  <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 space-y-1">
                    <p className="font-medium">⚠️ Nota sem itens/produtos</p>
                    <p className="text-xs text-amber-400/80">
                      {batchNfes[0].partialReason || "A busca pela chave de acesso retorna apenas os dados do cabeçalho da nota (número, série, CNPJ, UF). Para importar os produtos e realizar a conferência, utilize o modo XML com o arquivo da nota fiscal."}
                    </p>
                  </div>
                )}
                {batchNfes[0].nfeData.products.length > 0 && batchNfes[0].matches.length > 0 && batchNfes[0].matches.every((match) => match.matchType === "none") && (
                  <div className="rounded-lg p-3 bg-muted/30 border border-border text-sm space-y-1">
                    <p className="font-medium">Nenhum item foi vinculado automaticamente</p>
                    <p className="text-xs text-muted-foreground">
                      Revise EAN/SKU dos produtos cadastrados. Se preferir, siga com a importação e trate os itens como novos produtos.
                    </p>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => { setBatchNfes([]); setNfeData(null); setMatches([]); }}>
                    Trocar nota
                  </Button>
                  {batchNfes[0].nfeData.products.length === 0 ? (
                    <Button variant="outline" className="gap-2" onClick={() => { setBatchNfes([]); setNfeData(null); setMatches([]); setNfMode("xml"); }}>
                      <Upload className="h-4 w-4" /> Importar XML
                    </Button>
                  ) : (
                    <Button className="gap-2" onClick={() => goToStep(2)}>
                      Próximo <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Multiple NFs loaded — show table with checkboxes */}
          {batchNfes.length > 1 && !loading && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Files className="h-5 w-5" />
                    Notas carregadas ({batchNfes.length})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={toggleAllBatchNfes}>
                      {batchNfes.every((n) => n.selected) ? "Desmarcar todas" : "Selecionar todas"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[40px]" />
                      <TableHead>Nº NF</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-center">Itens</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[40px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchNfes.map((nf) => (
                      <TableRow key={nf.id} className={nf.nfeData.products.length === 0 ? "opacity-70" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={nf.selected}
                            disabled={nf.nfeData.products.length === 0}
                            onCheckedChange={() => toggleBatchNfe(nf.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{nf.nfeData.number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{nf.nfeData.issuerName}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span>{nf.nfeData.products.length}</span>
                            {nf.partialData && <Badge variant="outline" className="text-[10px]">Cabeçalho</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(nf.nfeData.totalValue)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBatchNfe(nf.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between p-4 border-t border-border bg-muted/10">
                  <div className="flex gap-6 text-sm">
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">{selectedBatchNfes.length}</strong> nota(s) selecionada(s)
                    </span>
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">{batchTotalItems}</strong> itens
                    </span>
                    <span className="text-muted-foreground">
                      Total: <strong className="text-primary">{formatCurrency(batchTotalValue)}</strong>
                    </span>
                  </div>
                  <Button onClick={() => goToStep(2)} disabled={selectedBatchNfes.length === 0} className="gap-2">
                    Avançar com {selectedBatchNfes.length} nota(s) <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========== STEP 2: CONFERÊNCIA ========== */}
      {currentStep === 2 && (
        <div className="space-y-5">
          {/* Batch mode: choose conference mode */}
          {isBatchMode && !batchConferenceMode && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6 text-center space-y-2">
                  <Layers className="h-10 w-10 text-primary mx-auto" />
                  <p className="text-lg font-bold">Como quer conferir este lote?</p>
                  <p className="text-sm text-muted-foreground">{selectedBatchNfes.length} notas com {batchTotalItems} itens no total</p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card
                  className="cursor-pointer border-2 hover:border-primary/50 transition-all"
                  onClick={() => startBatchConference("together")}
                >
                  <CardContent className="p-6 text-center space-y-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                      <span className="text-2xl">📋</span>
                    </div>
                    <p className="font-bold">Conferir todas juntas</p>
                    <p className="text-xs text-muted-foreground">
                      Todos os produtos de todas as notas aparecem numa lista única. Bipe qualquer produto de qualquer nota.
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer border-2 hover:border-primary/50 transition-all"
                  onClick={() => startBatchConference("one_by_one")}
                >
                  <CardContent className="p-6 text-center space-y-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                      <span className="text-2xl">📄</span>
                    </div>
                    <p className="font-bold">Conferir uma por uma</p>
                    <p className="text-xs text-muted-foreground">
                      Confira cada nota separadamente. Ao finalizar uma, avance para a próxima.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Batch one-by-one: NF progress bar */}
          {isBatchMode && batchConferenceMode === "one_by_one" && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">
                    Nota {currentBatchNfIdx + 1} de {selectedBatchNfes.length} — {selectedBatchNfes[currentBatchNfIdx]?.nfeData.issuerName}
                  </span>
                  <Badge variant="secondary">{selectedBatchNfes[currentBatchNfIdx]?.nfeData.products.length} itens — {formatCurrency(selectedBatchNfes[currentBatchNfIdx]?.nfeData.totalValue || 0)}</Badge>
                </div>
                <Progress value={((currentBatchNfIdx + 1) / selectedBatchNfes.length) * 100} className="h-2" />
                <div className="flex justify-between mt-3">
                  <Button variant="outline" size="sm" disabled={currentBatchNfIdx === 0} onClick={() => loadNfConference(currentBatchNfIdx - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> NF anterior
                  </Button>
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                    {batchConferenceDoneCount} de {selectedBatchNfes.length} conferidas
                  </Badge>
                  <Button variant="outline" size="sm" disabled={currentBatchNfIdx >= selectedBatchNfes.length - 1} onClick={() => { finishCurrentNfConference(); }}>
                    Próxima NF <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conference content (shared for single & batch once mode is selected) */}
          {(!isBatchMode || batchConferenceMode) && (
            <>
              {/* Bip Input */}
              <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium">Bipe ou digite o código de barras...</p>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <BarcodeScannerInput
                      ref={bipRef}
                      value={bipInput}
                      onChange={(v) => setBipInput(v)}
                      onScan={(code) => handleBip(code)}
                      placeholder="Bipe ou digite o código de barras..."
                      inputClassName="min-h-[48px] text-lg font-mono"
                      icon={<ScanBarcode className="h-5 w-5" />}
                      autoFocus
                      scanMode
                    />
                  </div>
                  <Button className="h-12" onClick={() => handleBip(bipInput)} disabled={!bipInput.trim()}>
                    Bipar
                  </Button>
                </div>
                  {bipAlert && (
                    <div className={`rounded-lg p-3 text-sm font-medium flex items-center gap-2 ${
                      bipAlert.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      bipAlert.type === "warning" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                      "bg-destructive/10 text-destructive border border-destructive/20"
                    }`}>
                      {bipAlert.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> :
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
                      {isBatchMode && batchConferenceMode === "together" && <TableHead className="w-[80px]">NF</TableHead>}
                      <TableHead className="w-[40px]" />
                      
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
                        <React.Fragment key={i}>
                          <TableRow className={`transition-all duration-500 ${
                            flashIdx === i ? "!bg-emerald-500/20" :
                            item.status === "ok" ? "bg-emerald-500/5" :
                            item.status === "excess" ? "bg-destructive/5" :
                            item.status === "partial" ? "bg-amber-500/5" : ""
                          }`}>
                            {isBatchMode && batchConferenceMode === "together" && (
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">{item.nfNumber}</Badge>
                              </TableCell>
                            )}
                            <TableCell className="text-center">
                              <button
                                onClick={() => {
                                   setUnknownGtinDialog({ code: "" });
                                  setUnknownGtinProduct(`idx-${i}`);
                                  setUnknownGtinQty(item.matchedProductBoxQty || 1);
                                  setUnknownGtinBoxes(1);
                                  setUnknownGtinSave(true);
                                }}
                                className={`text-lg transition-colors ${
                                  item.boxBadge
                                    ? "text-primary"
                                    : item.matchedProductGtinCx
                                    ? "text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.4)]"
                                    : "text-muted-foreground/40 hover:text-primary"
                                }`}
                                title={item.matchedProductGtinCx
                                  ? `GTIN CX cadastrado: ${item.matchedProductGtinCx} (${item.matchedProductBoxQty || '?'} un/cx)`
                                  : "Configurar entrada em caixa"
                                }
                              >
                                📦
                              </button>
                            </TableCell>
                            <TableCell>
                              <div className="h-9 w-9 rounded-lg bg-muted/30 flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{item.xmlProduct.description}</div>
                              {item.boxBadge && (
                                <Badge className="mt-1 bg-primary/15 text-primary border-primary/30 text-[10px]">{item.boxBadge}</Badge>
                              )}
                            </TableCell>
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

                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{conferenceProgress} de {conferenceItems.length} itens conferidos</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => { if (isBatchMode) { setBatchConferenceMode(null); } else { setCurrentStep(1); } }}>
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
            </>
          )}
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
                {(adjustedItems.length > 0 ? adjustedItems : itemsToShow).map((item, i) => (
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
            <Button variant="outline" onClick={() => setCurrentStep(matches.length > 0 || isBatchMode ? 3 : 1)}>
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
          {/* Batch: summary table per NF */}
          {isBatchMode ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resumo do Lote</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[50px]" />
                        <TableHead>Nº NF</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-center">Itens</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-center">Conferência</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBatchNfes.map((nf) => (
                        <TableRow key={nf.id}>
                          <TableCell>
                            <Checkbox
                              checked={batchSelectedForConfirm.has(nf.id)}
                              onCheckedChange={(v) => {
                                setBatchSelectedForConfirm((prev) => {
                                  const next = new Set(prev);
                                  if (v) next.add(nf.id); else next.delete(nf.id);
                                  return next;
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{nf.nfeData.number}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{nf.nfeData.issuerName}</TableCell>
                          <TableCell className="text-center">{nf.nfeData.products.length}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(nf.nfeData.totalValue)}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={
                              nf.conferenceStatus === "done"
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                : "bg-muted text-muted-foreground"
                            }>
                              {nf.conferenceStatus === "done" ? "Conferida" : "Pendente"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Total */}
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-semibold">Total Geral do Lote</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(batchTotalValue)}</p>
              </div>
            </>
          ) : (
            <>
              {/* Single mode summary */}
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
            </>
          )}

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={autoUpdateStock} onCheckedChange={(v) => setAutoUpdateStock(!!v)} />
              <span className="text-sm">Atualizar estoque {isBatchMode ? "de todas as notas" : "automaticamente"}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox checked={autoUpdateCost} onCheckedChange={(v) => setAutoUpdateCost(!!v)} />
              <span className="text-sm">Atualizar preço de custo</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(4)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <div className="flex gap-3">
              {isBatchMode && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setBatchSelectedForConfirm(new Set(selectedBatchNfes.map((n) => n.id)));
                  }}
                >
                  Selecionar todas
                </Button>
              )}
              <Button
                className="min-h-[48px] px-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={confirmarEntrada}
                disabled={saving || (isBatchMode && batchSelectedForConfirm.size === 0)}
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                {isBatchMode
                  ? batchSelectedForConfirm.size === selectedBatchNfes.length
                    ? "✓ Confirmar todas as entradas"
                    : `✓ Confirmar selecionadas (${batchSelectedForConfirm.size})`
                  : "✓ Confirmar entrada"}
              </Button>
            </div>
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
                {isBatchMode && batchConfirmResult ? (
                  <>
                    <p className="text-lg font-bold">{batchConfirmResult.confirmed} nota(s) confirmada(s) com sucesso!</p>
                    <p className="text-sm text-muted-foreground">
                      {batchConfirmResult.products} produtos adicionados ao estoque
                    </p>
                    <p className="text-lg font-bold text-primary mt-2">
                      Total: {formatCurrency(batchConfirmResult.total)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold">Entrada realizada com sucesso!</p>
                    <p className="text-sm text-muted-foreground">
                      {itemsToShow.length} produtos adicionados ao estoque
                    </p>
                  </>
                )}
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

      {/* Box Bip Dialog removed — now unified into the selection modal below */}

      {/* Unknown GTIN CX Dialog — Enhanced */}
      <Dialog open={!!unknownGtinDialog} onOpenChange={(v) => { if (!v) { setUnknownGtinDialog(null); setUnknownGtinProduct(""); setUnknownGtinQty(1); setUnknownGtinBoxes(1); setUnknownGtinSave(true); setTimeout(() => bipRef.current?.focus(), 50); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {unknownGtinDialog?.code ? (
                unknownGtinProduct ? (
                  <><Package className="h-5 w-5 text-primary" /> 📦 Caixa detectada — confirme o produto</>
                ) : (
                  <><AlertTriangle className="h-5 w-5 text-amber-400" /> Código não reconhecido</>
                )
              ) : (
                <><Package className="h-5 w-5 text-primary" /> Configurar entrada em caixa</>
              )}
            </DialogTitle>
            {unknownGtinDialog?.code && (
              <p className="text-sm text-muted-foreground">
                Código bipado: <span className="font-mono font-bold">{unknownGtinDialog.code}</span>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {unknownGtinDialog?.code ? "Selecione a qual produto desta nota pertence esta caixa:" : "Configure a quantidade de caixas e unidades:"}
            </p>
          </DialogHeader>

          <RadioGroup
            value={unknownGtinProduct}
            onValueChange={setUnknownGtinProduct}
            className="space-y-2 max-h-[200px] overflow-y-auto"
          >
            {conferenceItems.map((item, idx) => {
              const itemKey = `idx-${idx}`;
              return (
                <label
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    unknownGtinProduct === itemKey
                      ? "border-primary bg-primary/5"
                      : "border-border/40 hover:border-primary/30"
                  }`}
                >
                  <RadioGroupItem value={itemKey} />
                  <div className="h-10 w-10 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.xmlProduct.description}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{item.xmlProduct.code}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">Qtd: {item.expectedQty}</span>
                </label>
              );
            })}
          </RadioGroup>

          {unknownGtinProduct && (
            <div className="space-y-4 pt-2">
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Unidades por caixa</label>
                  <Input
                    type="number"
                    min={1}
                    value={unknownGtinQty}
                    onChange={(e) => setUnknownGtinQty(parseInt(e.target.value) || 1)}
                    placeholder="Ex: 12"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Qtd de caixas</label>
                  <Input
                    type="number"
                    min={1}
                    value={unknownGtinBoxes}
                    onChange={(e) => setUnknownGtinBoxes(parseInt(e.target.value) || 1)}
                    placeholder="1"
                  />
                </div>
              </div>

              {unknownGtinQty > 0 && unknownGtinBoxes > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    Total: <span className="font-bold text-foreground">{unknownGtinQty}</span> × <span className="font-bold text-foreground">{unknownGtinBoxes}</span> = <span className="font-bold text-primary text-lg">{unknownGtinQty * unknownGtinBoxes} unidades</span>
                  </p>
                </div>
              )}

              {unknownGtinDialog?.code && (
                <div className="flex items-start gap-2 rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                  <Checkbox
                    id="save-gtin-entrada"
                    checked={unknownGtinSave}
                    onCheckedChange={(checked) => setUnknownGtinSave(!!checked)}
                    className="mt-0.5"
                  />
                  <label htmlFor="save-gtin-entrada" className="text-sm cursor-pointer">
                    <span className="font-medium">Salvar este código como GTIN CX do produto {unknownGtinProduct.startsWith("idx-") ? conferenceItems[parseInt(unknownGtinProduct.replace("idx-", ""), 10)]?.xmlProduct.description || "" : conferenceItems.find((i) => i.matchedProductId === unknownGtinProduct)?.xmlProduct.description || ""}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">Nas próximas entradas será reconhecido automaticamente</span>
                  </label>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setUnknownGtinDialog(null); setUnknownGtinProduct(""); setUnknownGtinQty(1); setUnknownGtinBoxes(1); setUnknownGtinSave(true); setTimeout(() => bipRef.current?.focus(), 50); }}>Cancelar</Button>
            <Button disabled={!unknownGtinProduct || unknownGtinQty <= 0 || unknownGtinBoxes <= 0} onClick={async () => {
              if (!unknownGtinProduct || !unknownGtinDialog) return;
              const totalUnits = unknownGtinQty * unknownGtinBoxes;
              
              // Support both matched products (by ID) and unmatched products (by idx-N fallback)
              let productIdx: number;
              if (unknownGtinProduct.startsWith("idx-")) {
                productIdx = parseInt(unknownGtinProduct.replace("idx-", ""), 10);
              } else {
                productIdx = conferenceItems.findIndex((i) => i.matchedProductId === unknownGtinProduct);
              }
              const selectedItem = productIdx >= 0 && productIdx < conferenceItems.length ? conferenceItems[productIdx] : null;
              const productName = selectedItem?.xmlProduct.description || "";

              // Save GTIN CX if checkbox checked, code is non-empty, and product has a DB ID
              const actualProductId = unknownGtinProduct.startsWith("idx-") ? selectedItem?.matchedProductId : unknownGtinProduct;
              if (unknownGtinSave && unknownGtinDialog.code && actualProductId) {
                await supabase.from("products").update({
                  gtin_cx: unknownGtinDialog.code,
                  box_quantity: unknownGtinQty,
                }).eq("id", actualProductId);
                toast({ title: `GTIN CX salvo no produto ${productName}!` });
              }

              // Add scanned units
              if (productIdx !== -1) {
                setConferenceItems((prev) => {
                  const updated = [...prev];
                  const item = { ...updated[productIdx] };
                  item.scannedQty += totalUnits;
                  item.boxBadge = `📦 ${unknownGtinBoxes}cx × ${unknownGtinQty}un = ${totalUnits}un${unknownGtinSave ? " ✓ GTIN salvo" : ""}`;
                  if (item.scannedQty === item.expectedQty) item.status = "ok";
                  else if (item.scannedQty > item.expectedQty) item.status = "excess";
                  else if (item.scannedQty > 0) item.status = "partial";
                  updated[productIdx] = item;
                  return updated;
                });
                setBipAlert({ type: "success", msg: `📦 ${totalUnits} unidades adicionadas via caixa!` });
                playBeep(800, 100);
                bipRef.current?.flash(true);
              }

              setUnknownGtinDialog(null);
              setUnknownGtinProduct("");
              setUnknownGtinQty(1);
              setUnknownGtinBoxes(1);
              setUnknownGtinSave(true);
              setTimeout(() => bipRef.current?.focus(), 50);
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Restore progress dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>📋 Retomar nota em andamento?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Encontramos uma entrada de nota fiscal que não foi finalizada. Deseja continuar de onde parou?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={discardSavedState}>Descartar</Button>
            <Button onClick={restoreSavedState}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EntradaNota;
