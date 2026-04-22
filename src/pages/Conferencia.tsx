import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ScanBarcode, CheckCircle, AlertTriangle, Package, Loader2,
  Play, XCircle, Minus, Check, Clock, FileText, ClipboardList,
  ArrowRight, ArrowLeft, Download, RotateCcw, History, X, Save
} from "lucide-react";

const STORAGE_KEY = "conferencia-session-v1";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useProducts, useAllProducts } from "@/hooks/useProductData";
import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/BarcodeScannerInput";
import { ConferenceHistoryPanel } from "@/components/ConferenceHistoryPanel";
import { isValidEAN13 } from "@/lib/ean13";
import { fetchConferenceItemsGrouped, fetchConferenceTotals } from "@/lib/conference-recovery";

/**
 * Verifica se o código tem formato válido de código de barras
 * (EAN-8, UPC-A/12, EAN-13, EAN-14/GTIN-14 — usado em caixas)
 */
const isValidBarcodeFormat = (code: string): boolean => {
  if (!/^\d+$/.test(code)) return false;
  const len = code.length;
  if (![8, 12, 13, 14].includes(len)) return false;
  // Validamos dígito verificador apenas para EAN-13 (mais comum)
  if (len === 13) return isValidEAN13(code);
  return true;
};

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

const isUuid = (value: string | null | undefined) =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getConferenceItemStatus = (scannedQty: number, expectedQty: number) => {
  if (expectedQty <= 0) return scannedQty > 0 ? "ok" : "pendente";
  if (scannedQty === expectedQty) return "ok";
  if (scannedQty > expectedQty) return "excedente";
  return scannedQty > 0 ? "pendente" : "pendente";
};

const Conferencia = () => {
  const { toast } = useToast();
  const companyId = useCompanyId();
  const scanInputRef = useRef<BarcodeScannerInputHandle>(null);

  // Restore session from localStorage
  const restored = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || (data.step === 1 && !data.mode && !data.conferenceName && (!data.scannedProducts || data.scannedProducts.length === 0))) return null;
      return data;
    } catch { return null; }
  })();

  const [step, setStep] = useState<Step>(restored?.step ?? 1);
  const [mode, setMode] = useState<ConferenceMode | null>(restored?.mode ?? null);
  const [conferenceName, setConferenceName] = useState<string>(restored?.conferenceName ?? "");
  const [conferenceId, setConferenceId] = useState<string | null>(restored?.conferenceId ?? null);
  const [sessionRestored, setSessionRestored] = useState(!!restored);
  const [savingSession, setSavingSession] = useState(false);
  const [loadingConference, setLoadingConference] = useState(false);

  // Step 2
  const [scanBuffer, setScanBuffer] = useState("");
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>(
    (restored?.scannedProducts ?? []).map((p: any) => ({ ...p, lastBipAt: new Date(p.lastBipAt) }))
  );
  const [distinctProductsCount, setDistinctProductsCount] = useState<number | null>(restored?.distinctProductsCount ?? null);
  const [lastScan, setLastScan] = useState<{ success: boolean; name: string; code: string } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  // GTIN CX modal (unknown box code → user must select product)
  const [gtinModal, setGtinModal] = useState<GtinModalState>({
    open: false, code: "", selectedProductId: "", unitsPerBox: "", boxQty: "1", saveGtin: true
  });
  const [gtinSearch, setGtinSearch] = useState("");
  const [gtinSelectMode, setGtinSelectMode] = useState<"scan" | "list">("scan");
  const gtinScanInputRef = useRef<HTMLInputElement>(null);
  const [gtinScanValue, setGtinScanValue] = useState("");
  const [gtinScanLoading, setGtinScanLoading] = useState(false);
  const [gtinScanError, setGtinScanError] = useState<string | null>(null);
  const [gtinScanFlash, setGtinScanFlash] = useState<"success" | "error" | null>(null);

  // Search a product directly in the DB by barcode / sku / gtin_cx, scoped by company
  const searchProductByCode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return null;
    console.log("[Conferencia] Buscando produto:", trimmed, "company_id:", companyId);

    let q = supabase.from("products").select("*").limit(1);
    if (companyId) q = q.eq("company_id", companyId);

    // Try barcode first
    const { data: byBarcode, error: e1 } = await q.eq("barcode", trimmed).maybeSingle();
    console.log("[Conferencia] por barcode:", byBarcode, e1);
    if (byBarcode) return byBarcode;

    // Try SKU
    let q2 = supabase.from("products").select("*").limit(1);
    if (companyId) q2 = q2.eq("company_id", companyId);
    const { data: bySku, error: e2 } = await q2.eq("sku", trimmed).maybeSingle();
    console.log("[Conferencia] por sku:", bySku, e2);
    if (bySku) return bySku;

    // Try GTIN CX
    let q3 = supabase.from("products").select("*").limit(1);
    if (companyId) q3 = q3.eq("company_id", companyId);
    const { data: byGtin, error: e3 } = await q3.eq("gtin_cx", trimmed).maybeSingle();
    console.log("[Conferencia] por gtin_cx:", byGtin, e3);
    if (byGtin) return byGtin;

    return null;
  }, [companyId]);

  // Handler for the in-modal scan input (Enter / Bipar button / USB scanner)
  const handleGtinModalScan = useCallback(async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;
    setGtinScanError(null);
    setGtinScanLoading(true);
    try {
      const found = await searchProductByCode(trimmed);
      if (found) {
        const unitsPerBox = found.box_quantity ? String(found.box_quantity) : "";
        setGtinModal((prev) => ({ ...prev, selectedProductId: found.id, unitsPerBox }));
        setGtinScanFlash("success");
        setGtinScanValue("");
        playBeep(800, 100);
        setTimeout(() => setGtinScanFlash(null), 600);
      } else {
        setGtinScanError(trimmed);
        setGtinScanFlash("error");
        setGtinScanValue("");
        playBeep(300, 200);
        setTimeout(() => playBeep(300, 200), 220);
        setTimeout(() => setGtinScanFlash(null), 800);
        setTimeout(() => gtinScanInputRef.current?.focus(), 50);
      }
    } catch (err) {
      console.error("[Conferencia] Erro ao buscar produto:", err);
      setGtinScanError(trimmed);
      setGtinScanFlash("error");
    } finally {
      setGtinScanLoading(false);
    }
  }, [searchProductByCode]);

  // Auto-focus scan input when modal opens or tab switches to "scan"
  useEffect(() => {
    if (gtinModal.open && gtinSelectMode === "scan" && !gtinModal.selectedProductId) {
      const t = setTimeout(() => gtinScanInputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [gtinModal.open, gtinSelectMode, gtinModal.selectedProductId]);

  // GTIN CX FOUND modal (already linked product → just confirm box qty)
  const [gtinFoundModal, setGtinFoundModal] = useState<{
    open: boolean; product: any | null; code: string; unitsPerBox: string; boxQty: string;
  }>({ open: false, product: null, code: "", unitsPerBox: "", boxQty: "1" });
  const gtinFoundBoxQtyRef = useRef<HTMLInputElement>(null);

  // Confirm-qty-on-scan settings
  const [confirmOnScan, setConfirmOnScan] = useState<boolean>(() => {
    try { return localStorage.getItem("conferencia-confirm-on-scan") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("conferencia-confirm-on-scan", confirmOnScan ? "1" : "0"); } catch {}
  }, [confirmOnScan]);

  // Quick-confirm popup
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    product: any | null;
    qty: number;
    edited: boolean;
    existingQty: number;
    replaceMode: boolean;
  }>({ open: false, product: null, qty: 1, edited: false, existingQty: 0, replaceMode: false });
  const [confirmProgress, setConfirmProgress] = useState(100);
  const confirmTimerRef = useRef<number | null>(null);
  const confirmIntervalRef = useRef<number | null>(null);
  const confirmQtyInputRef = useRef<HTMLInputElement>(null);

  // Modal: EAN válido mas produto não cadastrado (chooser: caixa OU produto novo)
  const [unregisteredModal, setUnregisteredModal] = useState<{ open: boolean; code: string }>({
    open: false,
    code: "",
  });

  // Mini modal: cadastro rápido de produto a partir do código bipado
  const [quickRegister, setQuickRegister] = useState<{
    open: boolean;
    code: string;
    name: string;
    sku: string;
    price: string;
    stock: string;
    saving: boolean;
  }>({ open: false, code: "", name: "", sku: "", price: "", stock: "", saving: false });

  // Inline qty editing
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState<string>("");

  // Step 3
  const [adjusting, setAdjusting] = useState(false);

  // Load ALL products for conference using paginated fetch (bypass Supabase 1000-row cap)
  const { data: productsData, refetch: refetchProducts } = useAllProducts();
  const allProducts = productsData?.products ?? [];

  // Auto-save session to localStorage. Sessões ativas com itens em memória ou um conferenceId
  // válido NUNCA são apagadas — para evitar perder bipagens em uma recarga acidental da página.
  useEffect(() => {
    try {
      const isEmptySession =
        step === 1 && !mode && !conferenceName && !conferenceId && scannedProducts.length === 0;
      if (isEmptySession) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const payload: Record<string, unknown> = {
        step,
        mode,
        conferenceName,
        conferenceId,
        scannedProducts,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [step, mode, conferenceName, conferenceId, scannedProducts]);

  // Auto-persist each scan to the DB (debounced) so nothing is lost on browser crash.
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSessionRef = useRef<() => Promise<string | null>>();
  const loadConferenceItemsRef = useRef<(confId: string) => Promise<void>>();
  const hydratingFromServerRef = useRef(false);
  useEffect(() => {
    if (step !== 2) return;
    if (!companyId) return;
    if (scannedProducts.length === 0 && !conferenceId) return;
    if (hydratingFromServerRef.current) {
      hydratingFromServerRef.current = false;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveSessionRef.current?.()
        .then(async (confId) => {
          if (confId) {
            hydratingFromServerRef.current = true;
            await loadConferenceItemsRef.current?.(confId);
          }
        })
        .catch(() => {});
    }, 300);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [scannedProducts, step, companyId, conferenceId]);

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
    console.log('[Conferencia] ➕ addScannedUnits:', {
      productId: product?.id,
      productName: product?.name,
      units,
      boxInfo,
    });
    if (!product?.id || !units || units <= 0) {
      console.warn('[Conferencia] ⚠️ Bipagem ignorada — produto inválido ou unidades = 0', { product, units });
      return;
    }
    setFlashId(product.id);
    setTimeout(() => setFlashId(null), 1000);

    setScannedProducts((prev) => {
      const existing = prev.find((p) => p.productId === product.id);
      const next = existing
        ? prev.map((p) =>
            p.productId === product.id
              ? { ...p, scannedQty: p.scannedQty + units, lastBipAt: new Date(), boxInfo: boxInfo || p.boxInfo }
              : p,
          )
        : [
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
      console.log('[Conferencia] ✅ scannedProducts atualizado:', next.map(p => ({ name: p.name, qty: p.scannedQty })));
      return next;
    });
  }, []);

  const clearConfirmTimers = useCallback(() => {
    if (confirmTimerRef.current) { window.clearTimeout(confirmTimerRef.current); confirmTimerRef.current = null; }
    if (confirmIntervalRef.current) { window.clearInterval(confirmIntervalRef.current); confirmIntervalRef.current = null; }
  }, []);

  const startConfirmTimer = useCallback((product: any, qty: number) => {
    clearConfirmTimers();
    setConfirmProgress(100);
    const total = 30000;
    const start = Date.now();
    confirmIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      setConfirmProgress(Math.max(0, 100 - (elapsed / total) * 100));
    }, 50);
    confirmTimerRef.current = window.setTimeout(() => {
      clearConfirmTimers();
      addScannedUnits(product, qty);
      setLastScan({ success: true, name: product.name, code: product.barcode || product.sku });
      playBeep(800, 100);
      setConfirmModal((m) => ({ ...m, open: false }));
      setTimeout(() => scanInputRef.current?.focus(), 50);
    }, total);
  }, [addScannedUnits, clearConfirmTimers]);

  const openConfirmPopup = useCallback((product: any) => {
    const existing = scannedProducts.find((p) => p.productId === product.id);
    const existingQty = existing?.scannedQty ?? 0;
    setConfirmModal({ open: true, product, qty: 1, edited: false, existingQty, replaceMode: false });
    startConfirmTimer(product, 1);
    setTimeout(() => confirmQtyInputRef.current?.select(), 100);
  }, [scannedProducts, startConfirmTimer]);

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setScanBuffer("");

    const trimmed = code.trim();
    const normalized = trimmed.toUpperCase();
    // Variants to handle leading-zero differences (DUN-14 vs EAN-13)
    const variants = new Set<string>([normalized]);
    if (/^\d+$/.test(normalized)) {
      if (normalized.startsWith("0")) variants.add(normalized.replace(/^0+/, ""));
      variants.add("0" + normalized);
    }
    const simProducts = (window as any).__simProducts || [];

    const matchEan = (p: any) => {
      const barcode = (p.barcode || "").toString().trim().toUpperCase();
      return variants.has(barcode);
    };
    const matchGtinCx = (p: any) => {
      const g = (p.gtin_cx || "").toString().trim().toUpperCase();
      return !!g && variants.has(g);
    };
    const matchSku = (p: any) => {
      const sku = (p.sku || "").toString().trim().toUpperCase();
      const skuMl = (p.sku_ml || "").toString().trim().toUpperCase();
      return variants.has(sku) || variants.has(skuMl);
    };

    // STEP 1 — EAN unitário
    let porEan = allProducts.find(matchEan) || simProducts.find(matchEan);
    // STEP 2 — GTIN CX (caixa vinculada)
    let porGtinCx = !porEan ? allProducts.find(matchGtinCx) : null;
    // STEP 3 — SKU
    let porSku = !porEan && !porGtinCx ? (allProducts.find(matchSku) || simProducts.find(matchSku)) : null;

    // STEP 3.5 — Fallback no banco (caso allProducts esteja desatualizado/limitado)
    if (!porEan && !porGtinCx && !porSku) {
      const variantList = Array.from(variants);
      let q = supabase.from("products").select("*");
      if (companyId) q = q.eq("company_id", companyId);
      const { data: dbMatches } = await q
        .or(
          variantList.flatMap(v => [`barcode.eq.${v}`, `gtin_cx.eq.${v}`, `sku.eq.${v}`, `sku_ml.eq.${v}`]).join(",")
        )
        .limit(5);
      if (dbMatches && dbMatches.length > 0) {
        porEan = dbMatches.find(matchEan) || null;
        porGtinCx = !porEan ? (dbMatches.find(matchGtinCx) || null) : null;
        porSku = !porEan && !porGtinCx ? (dbMatches.find(matchSku) || null) : null;
        if (!porEan && !porGtinCx && !porSku) porEan = dbMatches[0];
      }
    }

    console.log('[Conferencia] Código bipado:', trimmed, 'variantes:', Array.from(variants));
    console.log('[Conferencia] Busca EAN:', porEan);
    console.log('[Conferencia] Busca GTIN CX:', porGtinCx);
    console.log('[Conferencia] Busca SKU:', porSku);

    const product = porEan || porSku;

    if (product) {
      if (confirmOnScan) {
        openConfirmPopup(product);
        return;
      }
      addScannedUnits(product, 1);
      setLastScan({ success: true, name: product.name, code: trimmed });
      playBeep(800, 100);
      scanInputRef.current?.flash(true);
      setTimeout(() => scanInputRef.current?.focus(), 50);
      return;
    }

    if (porGtinCx) {
      const unitsPerBox = porGtinCx.box_quantity ? String(porGtinCx.box_quantity) : "";
      setGtinFoundModal({
        open: true, product: porGtinCx, code: trimmed, unitsPerBox, boxQty: "1",
      });
      playBeep(800, 100);
      setTimeout(() => {
        if (unitsPerBox) gtinFoundBoxQtyRef.current?.select();
      }, 100);
      return;
    }

    // STEP 4 — Não reconhecido. Diferenciar:
    //  • 14 dígitos OU 13 dígitos começando com 1-8 → formato de CAIXA (GTIN CX)
    //  • 8/12/13 dígitos numéricos → EAN de produto não cadastrado
    //  • outros formatos → desconhecido (perguntar)
    const onlyDigits = /^\d+$/.test(trimmed);
    const firstDigit = onlyDigits ? parseInt(trimmed[0], 10) : NaN;
    const ehFormatoGtinCx = onlyDigits && (
      trimmed.length === 14 ||
      (trimmed.length === 13 && firstDigit >= 1 && firstDigit <= 8)
    );

    if (ehFormatoGtinCx) {
      // Caixa não cadastrada — abrir modal para vincular a um produto
      setGtinModal({
        open: true, code: trimmed, selectedProductId: "",
        unitsPerBox: "", boxQty: "1", saveGtin: true,
      });
      setLastScan({ success: false, name: "Caixa não cadastrada", code: trimmed });
      playBeep(500, 150);
      return;
    }

    const ehEanProduto = onlyDigits && (trimmed.length === 8 || trimmed.length === 12 || trimmed.length === 13);
    if (ehEanProduto && isValidBarcodeFormat(trimmed)) {
      setUnregisteredModal({ open: true, code: trimmed });
      setLastScan({ success: false, name: "Produto não cadastrado", code: trimmed });
      playBeep(500, 150);
      return;
    }

    // Formato desconhecido → perguntar (modal de GTIN/SKU)
    setGtinModal({
      open: true, code: trimmed, selectedProductId: "",
      unitsPerBox: "", boxQty: "1", saveGtin: true,
    });
    playBeep(400, 200);
  }, [allProducts, addScannedUnits, confirmOnScan, openConfirmPopup, companyId]);

  const adjustConfirmQty = (newQty: number) => {
    clearConfirmTimers();
    setConfirmModal((m) => ({ ...m, qty: Math.max(0, newQty), edited: true }));
  };

  const finalizeConfirm = () => {
    clearConfirmTimers();
    const { product, qty, replaceMode } = confirmModal;
    if (!product) return;
    if (replaceMode) {
      // set absolute qty
      setScannedProducts((prev) => {
        const exists = prev.find((p) => p.productId === product.id);
        if (exists) {
          return prev.map((p) => p.productId === product.id ? { ...p, scannedQty: qty, lastBipAt: new Date() } : p).filter(p => p.scannedQty > 0);
        }
        if (qty <= 0) return prev;
        return [{
          productId: product.id, name: product.name, sku: product.sku,
          barcode: product.barcode, imageUrl: product.image_url,
          scannedQty: qty, systemQty: product.stock_physical, lastBipAt: new Date(),
        }, ...prev];
      });
      setFlashId(product.id);
      setTimeout(() => setFlashId(null), 1000);
    } else if (qty > 0) {
      addScannedUnits(product, qty);
    }
    setLastScan({ success: true, name: product.name, code: product.barcode || product.sku });
    playBeep(800, 100);
    setConfirmModal({ open: false, product: null, qty: 1, edited: false, existingQty: 0, replaceMode: false });
    setTimeout(() => scanInputRef.current?.focus(), 50);
  };

  const cancelConfirm = () => {
    clearConfirmTimers();
    setConfirmModal({ open: false, product: null, qty: 1, edited: false, existingQty: 0, replaceMode: false });
    setTimeout(() => scanInputRef.current?.focus(), 50);
  };

  // Inline qty editing
  const startEditQty = (productId: string, currentQty: number) => {
    setEditingQtyId(productId);
    setEditingQtyValue(String(currentQty));
  };
  const commitEditQty = () => {
    if (!editingQtyId) return;
    const n = parseInt(editingQtyValue);
    if (!isNaN(n) && n >= 0) {
      setScannedProducts((prev) =>
        prev.map((p) => p.productId === editingQtyId ? { ...p, scannedQty: n, lastBipAt: new Date() } : p).filter(p => p.scannedQty > 0)
      );
    }
    setEditingQtyId(null);
    setEditingQtyValue("");
  };
  const cancelEditQty = () => { setEditingQtyId(null); setEditingQtyValue(""); };

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
  const uniqueProducts = new Set(scannedProducts.map((p) => p.productId).filter(Boolean)).size;
  const displayedUniqueProducts = distinctProductsCount ?? uniqueProducts;

  const startConference = async () => {
    if (!mode) {
      toast({ title: "Selecione um modo", variant: "destructive" });
      return;
    }
    // Create the conference row in DB so it appears in history & can be resumed from any device.
    if (!conferenceId && companyId) {
      try {
        const { data, error } = await supabase
          .from("conferences")
          .insert({
            company_id: companyId,
            tipo: mode === "inventario" ? "inventario" : "nota_fiscal",
            nome: conferenceName || `Conferência ${new Date().toLocaleString("pt-BR")}`,
            status: "em_andamento",
          } as any)
          .select()
          .single();
        if (error) throw error;
        setConferenceId((data as any).id);
      } catch (err: any) {
        toast({ title: "Erro ao iniciar conferência", description: err.message, variant: "destructive" });
        return;
      }
    }
    setStep(2);
  };

  const loadConferenceItems = useCallback(async (confId: string) => {
    setLoadingConference(true);
    try {
      const productImagesById = new Map(allProducts.map((p) => [p.id, p.image_url ?? null] as const));
      const [mapped, totals] = await Promise.all([
        fetchConferenceItemsGrouped(confId, productImagesById),
        fetchConferenceTotals(confId),
      ]);

      console.log(`[Conferencia restore] produtos únicos: ${totals.uniqueProducts} | total bipado: ${totals.totalBips}`);

      setScannedProducts(mapped as ScannedProduct[]);
      setDistinctProductsCount(totals.uniqueProducts);
    } catch (err: any) {
      console.error("[Conferencia restore] erro ao carregar itens", err);
      toast({ title: "Erro ao carregar itens", description: err.message, variant: "destructive" });
    } finally {
      setLoadingConference(false);
    }
  }, [allProducts, toast]);

  useEffect(() => {
    loadConferenceItemsRef.current = loadConferenceItems;
  }, [loadConferenceItems]);

  // Recarrega itens quando a sessão veio do recovery EXPLICITAMENTE (forceReload).
  // Não exige allProducts carregado — produtos só enriquecem nome/imagem; sku/ean/nome do bip
  // já vêm do banco, então a restauração funciona mesmo sem o catálogo pronto.
  useEffect(() => {
    if (step !== 2 || !conferenceId) return;
    if (!restored?.forceReload) return;
    loadConferenceItems(conferenceId);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        delete parsed.forceReload;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {}
  }, [step, conferenceId, loadConferenceItems, restored?.forceReload]);

  const saveSessionToDb = useCallback(async () => {
    if (!companyId) {
      toast({ title: "Empresa não identificada", variant: "destructive" });
      return null;
    }
    setSavingSession(true);
    try {
      let confId = conferenceId;
      // Create the conference if it doesn't exist yet.
      if (!confId) {
        const { data, error } = await supabase
          .from("conferences")
          .insert({
            company_id: companyId,
            tipo: mode === "inventario" ? "inventario" : "nota_fiscal",
            nome: conferenceName || `Conferência ${new Date().toLocaleString("pt-BR")}`,
            status: "em_andamento",
          } as any)
          .select()
          .single();
        if (error) throw error;
        confId = (data as any).id;
        setConferenceId(confId);
      }

      const { data: existingRows, error: existingErr } = await supabase
        .from("conference_items")
        .select("id, product_id, sku, ean, nome_produto")
        .eq("conference_id", confId!);
      if (existingErr) throw existingErr;

      const existingByKey = new Map(
        (existingRows ?? []).map((row: any) => [
          `${row.product_id ?? ""}::${row.sku ?? ""}::${row.ean ?? ""}::${row.nome_produto ?? ""}`,
          row,
        ]),
      );

      const nextKeys = new Set<string>();
      const updates = scannedProducts.map(async (p) => {
        const productId = isUuid(p.productId) ? p.productId : null;
        const key = `${productId ?? ""}::${p.sku ?? ""}::${p.barcode ?? ""}::${p.name ?? ""}`;
        nextKeys.add(key);

        const payload = {
          conference_id: confId!,
          product_id: productId,
          nome_produto: p.name,
          sku: p.sku,
          ean: p.barcode,
          expected_quantity: p.systemQty,
          scanned_quantity: p.scannedQty,
          status: getConferenceItemStatus(p.scannedQty, p.systemQty),
          tipo_contagem: p.boxInfo ? "caixa" : "unidade",
          detalhes_caixa: p.boxInfo ?? null,
        };

        const existing = existingByKey.get(key);
        if (existing) {
          const { error } = await supabase.from("conference_items").update(payload as any).eq("id", existing.id);
          if (error) throw error;
          return;
        }

        const { error } = await supabase.from("conference_items").insert(payload as any);
        if (error) throw error;
      });

      const resets = (existingRows ?? [])
        .filter((row: any) => !nextKeys.has(`${row.product_id ?? ""}::${row.sku ?? ""}::${row.ean ?? ""}::${row.nome_produto ?? ""}`))
        .map(async (row: any) => {
          const { error } = await supabase
            .from("conference_items")
            .update({ scanned_quantity: 0, status: "pendente", detalhes_caixa: null } as any)
            .eq("id", row.id);
          if (error) throw error;
        });

      await Promise.all([...updates, ...resets]);

      await supabase
        .from("conferences")
        .update({ updated_at: new Date().toISOString(), status: "em_andamento" } as any)
        .eq("id", confId!);

      return confId!;
    } catch (err: any) {
      toast({ title: "Erro ao salvar conferência", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setSavingSession(false);
    }
  }, [companyId, conferenceId, conferenceName, mode, scannedProducts, toast]);

  const handleRecalculateConference = useCallback(async () => {
    const confId = await saveSessionToDb();
    if (!confId) return;

    hydratingFromServerRef.current = true;
    await loadConferenceItems(confId);
    toast({
      title: "Conferência recalculada",
      description: "Totais e lista agrupada foram atualizados.",
    });
  }, [loadConferenceItems, saveSessionToDb, toast]);

  // Keep ref pointing at latest saveSessionToDb for the auto-save effect.
  useEffect(() => { saveSessionRef.current = saveSessionToDb; }, [saveSessionToDb]);

  const reset = () => {
    setStep(1);
    setMode(null);
    setConferenceName("");
    setConferenceId(null);
    setScannedProducts([]);
    setDistinctProductsCount(null);
    setLastScan(null);
    setScanBuffer("");
    setSessionRestored(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const [cancelling, setCancelling] = useState(false);
  const handleCancelConference = async () => {
    if (!confirm("Cancelar esta conferência? Os bips serão descartados e a conferência será marcada como cancelada.")) return;
    setCancelling(true);
    try {
      if (conferenceId) {
        await supabase
          .from("conferences")
          .update({ status: "cancelada", finished_at: new Date().toISOString() } as any)
          .eq("id", conferenceId);
      }
      toast({ title: "Conferência cancelada" });
      reset();
    } catch (err: any) {
      toast({ title: "Erro ao cancelar", description: err.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  // Quick register: opens the mini modal (also closes any source modal that triggered it)
  const openQuickRegister = useCallback((code: string) => {
    setUnregisteredModal({ open: false, code: "" });
    setGtinModal((prev) => ({ ...prev, open: false }));
    setQuickRegister({ open: true, code, name: "", sku: "", price: "", stock: "", saving: false });
  }, []);

  const handleQuickRegisterSave = async () => {
    const name = quickRegister.name.trim();
    if (!name) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do produto.", variant: "destructive" });
      return;
    }
    if (!companyId) {
      toast({ title: "Empresa não identificada", variant: "destructive" });
      return;
    }
    setQuickRegister((q) => ({ ...q, saving: true }));
    try {
      const sku = quickRegister.sku.trim() || `SKU-${Date.now().toString(36).toUpperCase()}`;
      const price = parseFloat(quickRegister.price.replace(",", ".")) || 0;
      const stock = parseInt(quickRegister.stock) || 0;
      const { data, error } = await supabase
        .from("products")
        .insert({
          company_id: companyId,
          name,
          sku,
          barcode: quickRegister.code,
          price,
          cost: 0,
          stock_physical: stock,
          stock_full: 0,
          min_stock: 0,
          active: true,
        } as any)
        .select()
        .single();
      if (error) throw error;
      await refetchProducts();
      const newProduct = data as any;
      setQuickRegister({ open: false, code: "", name: "", sku: "", price: "", stock: "", saving: false });
      toast({ title: "✅ Produto cadastrado e adicionado à conferência!" });
      // Open quantity popup so the user can confirm how many units
      setTimeout(() => openConfirmPopup(newProduct), 100);
    } catch (err: any) {
      toast({ title: "Erro ao cadastrar produto", description: err.message, variant: "destructive" });
      setQuickRegister((q) => ({ ...q, saving: false }));
    }
  };

  const gtinTotalUnits = (parseInt(gtinModal.unitsPerBox) || 0) * (parseInt(gtinModal.boxQty) || 0);
  const selectedGtinProduct = allProducts.find((p) => p.id === gtinModal.selectedProductId);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => (window.location.href = "/conferencia/recuperar")}
        >
          <History className="h-4 w-4 mr-2" /> Recuperar conferência
        </Button>
      </div>
      {/* Session restored indicator */}
      {sessionRestored && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2 text-sm">
          <History className="h-4 w-4 text-primary shrink-0" />
          <span className="text-foreground font-medium">Sessão restaurada</span>
          <span className="text-muted-foreground hidden sm:inline">— continuamos de onde você parou.</span>
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setSessionRestored(false)}>
            <X className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-7" onClick={reset}>
            Descartar
          </Button>
        </div>
      )}

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
          <ConferenceHistoryPanel
              onContinue={async (c) => {
                setConferenceName(c.nome ?? `Conferência ${c.id.slice(0, 6)}`);
                setMode(c.tipo === "inventario" ? "inventario" : "nf");
                setConferenceId(c.id);
                setScannedProducts([]);
                await loadConferenceItems(c.id);
                setStep(2);
                setSessionRestored(true);
                toast({ title: "Continuando conferência", description: c.nome ?? c.id.slice(0, 6) });
              }}
          />
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
                  <div className={`relative flex-1 transition-all rounded-xl ${gtinModal.open ? "ring-2 ring-blue-500/50" : ""}`}>
                    <BarcodeScannerInput
                      ref={scanInputRef}
                      value={scanBuffer}
                      onChange={(v) => setScanBuffer(v)}
                      onScan={(code) => { handleScan(code); setScanBuffer(""); }}
                      placeholder={gtinModal.open ? "Aguardando confirmação da caixa..." : "Bipe o próximo código..."}
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

                <div className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 p-2.5">
                  <Label htmlFor="confirm-on-scan" className="text-xs font-medium cursor-pointer">
                    Confirmar quantidade ao bipar
                  </Label>
                  <Switch
                    id="confirm-on-scan"
                    checked={confirmOnScan}
                    onCheckedChange={setConfirmOnScan}
                  />
                </div>
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
                          {editingQtyId === sp.productId ? (
                            <Input
                              autoFocus
                              type="number"
                              value={editingQtyValue}
                              onChange={(e) => setEditingQtyValue(e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onBlur={commitEditQty}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); commitEditQty(); }
                                else if (e.key === "Escape") { e.preventDefault(); cancelEditQty(); }
                              }}
                              className="h-8 w-16 text-center font-bold bg-blue-500/10 border-blue-500/40"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditQty(sp.productId, sp.scannedQty)}
                              className="font-bold text-lg w-8 text-center hover:bg-muted/40 rounded px-1 transition-colors"
                              title="Clique para editar"
                            >
                              {sp.scannedQty}
                            </button>
                          )}
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
                <CardTitle className="text-sm flex items-center justify-between">
                  Resumo em tempo real
                  {loadingConference && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </CardTitle>
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

                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
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
                  {/* Removido botão manual: recalculação agora é automática a cada bipagem */}
                  <Button
                    variant="secondary"
                    className="w-full"
                    size="sm"
                    onClick={async () => {
                      const confId = await saveSessionToDb();
                      if (confId) {
                        toast({
                          title: "Conferência salva",
                          description: "Seus bips ficaram guardados. Você pode continuar de qualquer dispositivo.",
                        });
                        setStep(1);
                      }
                    }}
                    disabled={scannedProducts.length === 0 || savingSession}
                  >
                    {savingSession
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                      : <><Save className="h-4 w-4 mr-2" /> Salvar e continuar depois</>
                    }
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    size="sm"
                    onClick={handleCancelConference}
                    disabled={cancelling}
                  >
                    {cancelling
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cancelando...</>
                      : <><X className="h-4 w-4 mr-2" /> Cancelar conferência</>
                    }
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

      {/* ========== GTIN CX FOUND (auto) MODAL ========== */}
      <Dialog open={gtinFoundModal.open} onOpenChange={(open) => {
        if (!open) {
          setGtinFoundModal((p) => ({ ...p, open: false }));
          setTimeout(() => scanInputRef.current?.focus(), 50);
        }
      }}>
        <DialogContent className="max-w-[420px] w-[calc(100%-2rem)] p-4 gap-3 border-emerald-500/50 max-h-[88vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base pr-6">
              <Package className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="truncate">📦 Caixa vinculada encontrada!</span>
            </DialogTitle>
          </DialogHeader>

          {gtinFoundModal.product && (
            <div className="space-y-3 min-w-0">
              <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 min-w-0">
                {gtinFoundModal.product.image_url ? (
                  <img src={gtinFoundModal.product.image_url} alt={gtinFoundModal.product.name} className="h-11 w-11 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="h-11 w-11 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{gtinFoundModal.product.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">{gtinFoundModal.product.sku}</p>
                  <p className="text-[10px] font-mono text-emerald-400 mt-0.5 truncate">GTIN CX: {gtinFoundModal.code} ✓</p>
                </div>
              </div>

              {(() => {
                const unitsNum = parseInt(gtinFoundModal.unitsPerBox) || 0;
                const boxesNum = parseInt(gtinFoundModal.boxQty) || 0;
                const totalNum = unitsNum * boxesNum;
                const product = gtinFoundModal.product;
                const code = gtinFoundModal.code;

                const doConfirm = async () => {
                  console.log('[Conferencia] 📦 Confirmando caixa:', { product: product?.name, productId: product?.id, unitsNum, boxesNum, totalNum });
                  if (totalNum <= 0 || !product) {
                    console.warn('[Conferencia] ⚠️ Caixa não confirmada — total ou produto inválido', { totalNum, hasProduct: !!product });
                    toast({ title: "Informe unidades por caixa e quantidade", variant: "destructive" });
                    return;
                  }
                  if (unitsNum > 0 && unitsNum !== product.box_quantity) {
                    try {
                      await supabase.from("products").update({ box_quantity: unitsNum }).eq("id", product.id);
                      refetchProducts();
                    } catch {}
                  }
                  addScannedUnits(product, totalNum, {
                    boxes: boxesNum, unitsPerBox: unitsNum, totalUnits: totalNum, gtinSaved: true,
                  });
                  setLastScan({
                    success: true,
                    name: `📦 ${product.name} — ${boxesNum}cx × ${unitsNum}un = ${totalNum} un.`,
                    code,
                  });
                  playBeep(800, 100);
                  setGtinFoundModal({ open: false, product: null, code: "", unitsPerBox: "", boxQty: "1" });
                  setTimeout(() => scanInputRef.current?.focus(), 50);
                };

                const closeAll = () => {
                  setGtinFoundModal({ open: false, product: null, code: "", unitsPerBox: "", boxQty: "1" });
                  setTimeout(() => scanInputRef.current?.focus(), 50);
                };

                return (
                  <>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="min-w-0">
                        <Label className="text-[11px]">Unidades por caixa</Label>
                        <Input
                          type="number"
                          min="1"
                          value={gtinFoundModal.unitsPerBox}
                          onChange={(e) => setGtinFoundModal((p) => ({ ...p, unitsPerBox: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); closeAll(); } }}
                          autoFocus={!gtinFoundModal.unitsPerBox}
                          placeholder="Ex: 12"
                          className="text-center text-base font-bold h-10 mt-1 w-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <Label className="text-[11px]">Qtd. de caixas</Label>
                        <Input
                          ref={gtinFoundBoxQtyRef}
                          type="number"
                          min="1"
                          value={gtinFoundModal.boxQty}
                          onChange={(e) => setGtinFoundModal((p) => ({ ...p, boxQty: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); doConfirm(); }
                            else if (e.key === "Escape") { e.preventDefault(); closeAll(); }
                          }}
                          autoFocus={!!gtinFoundModal.unitsPerBox}
                          className="text-center text-base font-bold h-10 mt-1 w-full"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/40 p-2.5 text-center min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                      <p className="text-xl font-bold text-blue-400 leading-tight">{totalNum} un</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {boxesNum} cx × {unitsNum} un = {totalNum} un
                      </p>
                    </div>

                    <DialogFooter className="flex-row justify-end gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={closeAll}>Cancelar</Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={totalNum <= 0}
                        onClick={doConfirm}
                      >
                        ✓ Confirmar
                      </Button>
                    </DialogFooter>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========== CÓDIGO NÃO RECONHECIDO — CHOOSER ========== */}
      <Dialog
        open={unregisteredModal.open}
        onOpenChange={(open) => {
          if (!open) {
            setUnregisteredModal({ open: false, code: "" });
            setTimeout(() => scanInputRef.current?.focus(), 50);
          }
        }}
      >
        <DialogContent className="max-w-[460px] w-[calc(100%-2rem)] border-amber-500/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Código não reconhecido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">Código bipado</p>
              <p className="font-mono text-base font-semibold text-foreground break-all">
                {unregisteredModal.code}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">O que é este código?</p>
            <button
              type="button"
              onClick={() => {
                const code = unregisteredModal.code;
                setUnregisteredModal({ open: false, code: "" });
                setGtinModal({
                  open: true, code, selectedProductId: "",
                  unitsPerBox: "", boxQty: "1", saveGtin: true,
                });
              }}
              className="w-full rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 p-4 text-left transition-colors flex items-start gap-3"
            >
              <Package className="h-6 w-6 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">📦 É uma CAIXA</p>
                <p className="text-xs text-muted-foreground">Vincular a um produto existente</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => openQuickRegister(unregisteredModal.code)}
              className="w-full rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 p-4 text-left transition-colors flex items-start gap-3"
            >
              <Package className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">🏷️ É um PRODUTO novo</p>
                <p className="text-xs text-muted-foreground">Cadastrar rapidamente no sistema</p>
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setUnregisteredModal({ open: false, code: "" });
                setTimeout(() => scanInputRef.current?.focus(), 50);
              }}
            >
              <X className="h-4 w-4 mr-1" /> Ignorar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== MINI MODAL: CADASTRO RÁPIDO ========== */}
      <Dialog
        open={quickRegister.open}
        onOpenChange={(open) => {
          if (!open && !quickRegister.saving) {
            setQuickRegister({ open: false, code: "", name: "", sku: "", price: "", stock: "", saving: false });
            setTimeout(() => scanInputRef.current?.focus(), 50);
          }
        }}
      >
        <DialogContent className="max-w-[460px] w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5 text-emerald-400" />
              ➕ Cadastrar produto rápido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">EAN detectado</p>
              <p className="font-mono text-sm font-semibold text-foreground break-all">
                {quickRegister.code}
              </p>
            </div>
            <div>
              <Label htmlFor="qr-name">Nome do produto *</Label>
              <Input
                id="qr-name"
                autoFocus
                value={quickRegister.name}
                onChange={(e) => setQuickRegister((q) => ({ ...q, name: e.target.value }))}
                placeholder="Ex.: Camiseta Azul M"
              />
            </div>
            <div>
              <Label htmlFor="qr-sku">SKU (opcional)</Label>
              <Input
                id="qr-sku"
                value={quickRegister.sku}
                onChange={(e) => setQuickRegister((q) => ({ ...q, sku: e.target.value }))}
                placeholder="Gerado automaticamente se vazio"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="qr-price">Preço de venda (R$)</Label>
                <Input
                  id="qr-price"
                  inputMode="decimal"
                  value={quickRegister.price}
                  onChange={(e) => setQuickRegister((q) => ({ ...q, price: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label htmlFor="qr-stock">Estoque inicial</Label>
                <Input
                  id="qr-stock"
                  inputMode="numeric"
                  value={quickRegister.stock}
                  onChange={(e) => setQuickRegister((q) => ({ ...q, stock: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-200">
              ⚠️ Apenas o nome é obrigatório. Complete o cadastro depois em Produtos.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={quickRegister.saving}
              onClick={() => {
                setQuickRegister({ open: false, code: "", name: "", sku: "", price: "", stock: "", saving: false });
                setTimeout(() => scanInputRef.current?.focus(), 50);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleQuickRegisterSave} disabled={quickRegister.saving || !quickRegister.name.trim()}>
              {quickRegister.saving
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando...</>
                : <><Check className="h-4 w-4 mr-1" /> Cadastrar e bipar</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== GTIN CX MODAL — CAIXA DETECTADA ========== */}
      <Dialog open={gtinModal.open} onOpenChange={(open) => {
        if (!open) {
          setGtinModal((prev) => ({ ...prev, open: false }));
          setGtinSearch("");
          setGtinSelectMode("scan");
          setGtinScanError(null);
          setGtinScanValue("");
          setTimeout(() => scanInputRef.current?.focus(), 50);
        }
      }}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden border border-blue-500/40 rounded-xl bg-[hsl(var(--card))] flex flex-col w-[calc(100%-1.5rem)] max-w-[420px] max-h-[88vh]"
        >
          {/* ============ HEADER ============ */}
          <DialogHeader className="flex-shrink-0 p-3 border-b border-border/40 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
                <Package className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="truncate">📦 Caixa detectada</span>
              </DialogTitle>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono truncate">
              Código: <span className="font-bold text-foreground">{gtinModal.code}</span>
            </p>

            {/* Tabs (selection step only) */}
            {!gtinModal.selectedProductId && (
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setGtinSelectMode("scan");
                    setGtinScanError(null);
                    setTimeout(() => gtinScanInputRef.current?.focus(), 50);
                  }}
                  className={`h-8 rounded-md text-xs font-medium transition-colors ${
                    gtinSelectMode === "scan"
                      ? "bg-blue-600 text-white"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  📷 Bipar
                </button>
                <button
                  type="button"
                  onClick={() => setGtinSelectMode("list")}
                  className={`h-8 rounded-md text-xs font-medium transition-colors ${
                    gtinSelectMode === "list"
                      ? "bg-blue-600 text-white"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  🔍 Buscar lista
                </button>
              </div>
            )}

            {/* Selected product summary */}
            {gtinModal.selectedProductId && (() => {
              const sel = allProducts.find((p) => p.id === gtinModal.selectedProductId);
              return (
                <div className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/5 p-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setGtinModal((prev) => ({ ...prev, selectedProductId: "" }))}
                    className="h-7 w-7 rounded-md hover:bg-muted/40 flex items-center justify-center shrink-0"
                    title="Voltar"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  {sel?.image_url ? (
                    <img src={sel.image_url} alt={sel.name} className="h-9 w-9 rounded-md object-cover shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-md bg-muted/30 flex items-center justify-center shrink-0">
                      <Package className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">{sel?.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">{sel?.sku}</p>
                  </div>
                </div>
              );
            })()}
          </DialogHeader>

          {/* ============ BODY ============ */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
            {/* SCAN MODE */}
            {!gtinModal.selectedProductId && gtinSelectMode === "scan" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Bipe o EAN/SKU do produto desta caixa:
                </p>
                <div className="flex gap-2">
                  <Input
                    ref={gtinScanInputRef}
                    type="text"
                    inputMode="numeric"
                    value={gtinScanValue}
                    onChange={(e) => { setGtinScanValue(e.target.value); setGtinScanError(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        handleGtinModalScan(gtinScanValue);
                      }
                    }}
                    placeholder={gtinScanLoading ? "Buscando..." : "Bipe ou digite..."}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    disabled={gtinScanLoading}
                    autoFocus
                    className={`h-9 text-sm font-mono flex-1 transition-colors ${
                      gtinScanFlash === "success" ? "border-emerald-500 bg-emerald-500/5" :
                      gtinScanFlash === "error" ? "border-red-500 bg-red-500/5" : ""
                    }`}
                  />
                  <Button
                    type="button"
                    onClick={() => handleGtinModalScan(gtinScanValue)}
                    disabled={!gtinScanValue.trim() || gtinScanLoading}
                    className="h-9 shrink-0 bg-blue-600 hover:bg-blue-600/90 text-white px-3 text-xs"
                  >
                    {gtinScanLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
                {gtinScanError && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 space-y-1.5">
                    <p className="text-[13px] font-semibold text-red-400">❌ Item não cadastrado</p>
                    <p className="font-mono text-[11px] text-muted-foreground">Código: {gtinScanError}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => { setGtinScanError(null); setGtinSelectMode("list"); }}
                      >
                        🔍 Buscar na lista
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => { setGtinScanError(null); setGtinScanValue(""); setTimeout(() => gtinScanInputRef.current?.focus(), 50); }}
                      >
                        ↩️ Tentar outro
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LIST MODE */}
            {!gtinModal.selectedProductId && gtinSelectMode === "list" && (
              <div className="space-y-2">
                <Input
                  value={gtinSearch}
                  onChange={(e) => setGtinSearch(e.target.value)}
                  placeholder="🔍 Buscar produto..."
                  className="h-9 text-sm"
                  autoFocus
                />
                <div className="flex flex-col gap-0.5 max-h-[220px] overflow-y-auto rounded-md border border-border/40 p-1">
                  {allProducts
                    .filter((p) => {
                      if (!gtinSearch.trim()) return true;
                      const q = gtinSearch.toLowerCase();
                      return (p.name || "").toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q);
                    })
                    .slice(0, 50)
                    .map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          const unitsPerBox = p.box_quantity ? String(p.box_quantity) : "";
                          setGtinModal((prev) => ({ ...prev, selectedProductId: p.id, unitsPerBox: prev.unitsPerBox || unitsPerBox }));
                        }}
                        className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-blue-500/10 transition-colors text-left"
                      >
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="h-7 w-7 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-7 w-7 rounded bg-muted/30 flex items-center justify-center shrink-0">
                            <Package className="h-3 w-3 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate leading-tight">{p.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{p.sku}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* QUANTITY STEP */}
            {gtinModal.selectedProductId && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground block mb-1">Unidades/caixa</Label>
                    <Input
                      type="number"
                      min="1"
                      value={gtinModal.unitsPerBox}
                      onChange={(e) => setGtinModal((prev) => ({ ...prev, unitsPerBox: e.target.value }))}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && gtinTotalUnits > 0) { e.preventDefault(); handleGtinConfirm(); }
                      }}
                      placeholder="Ex: 12"
                      className="h-10 text-base font-semibold text-center"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground block mb-1">Qtd de caixas</Label>
                    <Input
                      type="number"
                      min="1"
                      value={gtinModal.boxQty}
                      onChange={(e) => setGtinModal((prev) => ({ ...prev, boxQty: e.target.value }))}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && gtinTotalUnits > 0) { e.preventDefault(); handleGtinConfirm(); }
                      }}
                      placeholder="1"
                      className="h-10 text-base font-semibold text-center"
                    />
                  </div>
                </div>

                {gtinTotalUnits > 0 && (
                  <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-2 text-center">
                    <p className="text-[10px] text-blue-300/80">
                      {gtinModal.boxQty} cx × {gtinModal.unitsPerBox} un
                    </p>
                    <p className="text-lg font-bold text-foreground leading-tight">
                      = {gtinTotalUnits} unidades
                    </p>
                  </div>
                )}

                <label htmlFor="save-gtin" className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    id="save-gtin"
                    checked={gtinModal.saveGtin}
                    onCheckedChange={(checked) => setGtinModal((prev) => ({ ...prev, saveGtin: !!checked }))}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    <span className="font-medium text-foreground">Salvar GTIN CX neste produto</span>
                    <span className="block text-[10px]">Reconhecimento automático nas próximas vezes</span>
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* ============ FOOTER ============ */}
          <div className="flex-shrink-0 p-3 border-t border-border/40 flex items-center justify-end gap-2">
            {gtinModal.selectedProductId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGtinModal((prev) => ({ ...prev, selectedProductId: "" }))}
              >
                ← Voltar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setGtinModal((prev) => ({ ...prev, open: false }));
                setTimeout(() => scanInputRef.current?.focus(), 50);
              }}
            >
              Cancelar
            </Button>
            {!gtinModal.selectedProductId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openQuickRegister(gtinModal.code)}
                className="text-emerald-300"
              >
                🏷️ Na verdade é um produto
              </Button>
            )}
            {gtinModal.selectedProductId && (
              <Button
                size="sm"
                onClick={handleGtinConfirm}
                disabled={gtinTotalUnits <= 0}
                className="bg-blue-600 hover:bg-blue-600/90 text-white"
              >
                ✓ Confirmar {gtinTotalUnits > 0 ? `${gtinTotalUnits} un` : ""}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== QUICK CONFIRM QTY POPUP ========== */}
      <Dialog
        open={confirmModal.open}
        onOpenChange={(open) => { if (!open) cancelConfirm(); }}
      >
        <DialogContent className="max-w-sm border-emerald-500/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              {confirmModal.product?.name}
            </DialogTitle>
            <p className="text-xs font-mono text-muted-foreground">{confirmModal.product?.sku}</p>
          </DialogHeader>

          {confirmModal.existingQty > 0 && !confirmModal.replaceMode && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs space-y-1">
              <p>Já contado: <span className="font-bold">{confirmModal.existingQty}</span> un.</p>
              <p>Total ficará: <span className="font-bold">{confirmModal.existingQty + confirmModal.qty}</span> un.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">
              {confirmModal.replaceMode ? "Substituir total para:" : "Quantidade a adicionar:"}
            </Label>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 shrink-0"
                onClick={() => adjustConfirmQty(confirmModal.qty - 1)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                ref={confirmQtyInputRef}
                type="number"
                value={confirmModal.qty}
                onChange={(e) => adjustConfirmQty(parseInt(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); finalizeConfirm(); }
                  else if (e.key === "Escape") { e.preventDefault(); cancelConfirm(); }
                }}
                className="text-center text-2xl font-bold h-12"
              />
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 shrink-0"
                onClick={() => adjustConfirmQty(confirmModal.qty + 1)}
              >
                <span className="text-lg">+</span>
              </Button>
            </div>
          </div>

          {!confirmModal.edited && !confirmModal.replaceMode && (
            <div className="space-y-1">
              <Progress value={confirmProgress} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground text-center">
                Confirmação automática em instantes...
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={cancelConfirm} className="flex-1">
              Cancelar
            </Button>
            {confirmModal.existingQty > 0 && !confirmModal.replaceMode && (
              <Button
                variant="secondary"
                onClick={() => {
                  clearConfirmTimers();
                  setConfirmModal((m) => ({ ...m, replaceMode: true, qty: m.existingQty, edited: true }));
                  setTimeout(() => confirmQtyInputRef.current?.select(), 50);
                }}
                className="flex-1"
              >
                Substituir total
              </Button>
            )}
            <Button onClick={finalizeConfirm} className="flex-1">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Conferencia;
