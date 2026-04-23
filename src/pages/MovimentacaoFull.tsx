import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowRight, ScanBarcode, Package, Truck, Loader2, Plus, Minus,
  Trash2, Check, ChevronRight, Clock, CheckCircle, AlertTriangle, Boxes, PackageOpen,
  Video, Square, Pause, Play, Circle, Maximize2, Minimize2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GravacoesFullTab } from "@/components/GravacoesFullTab";
import { OrdensFullTab } from "@/components/OrdensFullTab";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFullRecorder, formatDuration } from "@/hooks/useFullRecorder";
import { useCompanyId } from "@/hooks/useCompanyId";
import {
  useTransferOrders, useCreateTransferOrder, useUpdateTransferStatus,
  type TransferItem, type TransferOrder
} from "@/hooks/useTransferData";
import { useKits, type Kit } from "@/hooks/useKitData";
import { useEnvioPendente, useLimparEnvioPendente, useMarcarOrdemEnviada, useUpdateOrdemStatus } from "@/hooks/useOrdensFull";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/BarcodeScannerInput";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ClipboardList, X } from "lucide-react";

interface SuccessInfo {
  orderNumber: string;
  durationSec: number;
  videoUrl: string | null;
  pdfBlobUrl: string;
}

interface BoxConfig {
  productId: string;
  gtinCx: string;
  unitsPerBox: number;
  boxCount: number;
}

const MovimentacaoFull = () => {
  const { toast } = useToast();
  const scanInputRef = useRef<BarcodeScannerInputHandle>(null);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [usedKits, setUsedKits] = useState<string[]>([]);
  const [scanBuffer, setScanBuffer] = useState("");
  const [lastScan, setLastScan] = useState<{ success: boolean; message: string } | null>(null);

  // Ordem ativa carregada via localStorage (vinda da aba Ordens)
  type OrdemAtivaProduto = {
    product_id: string; name: string; sku: string; barcode: string | null;
    image_url: string | null; stock_physical: number; qtd_solicitada: number;
  };
  type OrdemAtiva = { id: string; numero: string; descricao: string | null; produtos: OrdemAtivaProduto[] };
  const [ordemAtiva, setOrdemAtiva] = useState<OrdemAtiva | null>(null);
  const [qtdBipada, setQtdBipada] = useState<Record<string, number>>({});

  // Box mode state
  const [boxModeEnabled, setBoxModeEnabled] = useState(false);
  const [boxConfigs, setBoxConfigs] = useState<Record<string, BoxConfig>>({});
  const [expandedBoxProduct, setExpandedBoxProduct] = useState<string | null>(null);
  const [boxForm, setBoxForm] = useState<{ gtinCx: string; unitsPerBox: string; boxCount: string }>({ gtinCx: "", unitsPerBox: "", boxCount: "" });

  const { data: orders } = useTransferOrders();
  const { data: kits } = useKits();
  const createOrder = useCreateTransferOrder();
  const updateStatus = useUpdateTransferStatus();
  const companyId = useCompanyId();
  const recorder = useFullRecorder();
  const { data: envioPendente } = useEnvioPendente();
  const limparPendente = useLimparEnvioPendente();
  const marcarEnviada = useMarcarOrdemEnviada();
  const updateStatusOrdem = useUpdateOrdemStatus();
  const [loadedOrdemIds, setLoadedOrdemIds] = useState<string[]>([]);

  // Recording UI state
  const [showAskRecord, setShowAskRecord] = useState(false);
  const [showCameraPicker, setShowCameraPicker] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [recordingMode, setRecordingMode] = useState<"separacao" | "despacho">("separacao");
  const [despachoOrderId, setDespachoOrderId] = useState<{ id: string; number: string } | null>(null);
  const [askedOnce, setAskedOnce] = useState(false);
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  // Pergunta gravação ao bipar o primeiro item (apenas para separação)
  useEffect(() => {
    if (items.length > 0 && !askedOnce && recorder.status === "idle" && loadedOrdemIds.length === 0) {
      setRecordingMode("separacao");
      setAskedOnce(true);
      setShowAskRecord(true);
    }
  }, [items.length, askedOnce, recorder.status, loadedOrdemIds.length]);

  // Carrega ordem ativa do localStorage (vinda do clique em "Executar"/"Iniciar separação")
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ordem_ativa");
      if (!raw) return;
      const ordem: OrdemAtiva = JSON.parse(raw);
      if (!ordem?.produtos?.length) return;
      setOrdemAtiva(ordem);
      setLoadedOrdemIds([ordem.id]);
      const loaded: TransferItem[] = ordem.produtos.map((p) => ({
        productId: p.product_id,
        productName: p.name,
        productSku: p.sku,
        barcode: p.barcode,
        quantity: 0,
        stockPhysical: p.stock_physical,
      }));
      setItems(loaded);
      const initBipada: Record<string, number> = {};
      ordem.produtos.forEach((p) => { initBipada[p.product_id] = 0; });
      setQtdBipada(initBipada);
      toast({ title: `📋 Ordem ${ordem.numero} carregada — bipe os produtos para confirmar` });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega itens de envio_pendente automaticamente (fluxo legado, só se não houver ordem ativa via localStorage)
  useEffect(() => {
    if (ordemAtiva) return;
    if (!envioPendente || envioPendente.length === 0) return;
    if (items.length > 0) return;
    const loaded: TransferItem[] = envioPendente
      .filter((ep: any) => ep.product)
      .map((ep: any) => ({
        productId: ep.product.id,
        productName: ep.product.name,
        productSku: ep.product.sku,
        barcode: ep.product.barcode,
        quantity: ep.quantidade,
        stockPhysical: ep.product.stock_physical,
      }));
    if (loaded.length > 0) {
      setItems(loaded);
      const ordemIds = Array.from(new Set(envioPendente.map((ep: any) => ep.ordem_id))) as string[];
      setLoadedOrdemIds(ordemIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envioPendente, ordemAtiva]);

  const openCameraPicker = async () => {
    setShowAskRecord(false);
    const list = await recorder.listCameras();
    if (list.length === 0) {
      toast({ title: "Nenhuma câmera detectada ou permissão negada.", description: "Permita o acesso à câmera nas configurações do navegador.", variant: "destructive" });
      return;
    }
    setSelectedCamera(list[0].deviceId);
    setShowCameraPicker(true);
  };

  const startRecording = async () => {
    setShowCameraPicker(false);
    await recorder.start(selectedCamera);
    if (recordingMode === "despacho") {
      toast({ title: "🔴 Gravando despacho..." });
    } else {
      toast({ title: "🔴 Gravando separação..." });
    }
  };

  const stopAndUpload = async (envioId: string, orderNumber: string, tipo: "separacao" | "despacho") => {
    if (!companyId) return;
    const blob = await recorder.stop();
    if (!blob || blob.size === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      await recorder.uploadAndSave({
        blob, companyId, userId: user.id, envioId, orderNumber, tipo,
        duracaoSegundos: recorder.seconds,
      });
      toast({ title: `📹 Gravação salva (${formatDuration(recorder.seconds)})` });
    } catch (e: any) {
      toast({ title: "Erro ao salvar gravação", description: e.message, variant: "destructive" });
    } finally {
      recorder.reset();
    }
  };


  const addOrIncrementItem = (
    currentItems: TransferItem[],
    product: { id: string; name: string; sku: string; barcode: string | null; stock_physical: number },
    qty: number
  ): { items: TransferItem[]; added: boolean; message: string } => {
    const existing = currentItems.find((i) => i.productId === product.id);
    if (existing) {
      const maxQty = product.stock_physical;
      const newQty = Math.min(existing.quantity + qty, maxQty);
      if (existing.quantity >= maxQty) {
        return { items: currentItems, added: false, message: `Estoque máximo atingido para "${product.name}" (${maxQty}).` };
      }
      return {
        items: currentItems.map((i) => i.productId === product.id ? { ...i, quantity: newQty } : i),
        added: true,
        message: `${product.name} — ${newQty} un.`,
      };
    }
    return {
      items: [...currentItems, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        barcode: product.barcode,
        quantity: qty,
        stockPhysical: product.stock_physical,
      }],
      added: true,
      message: `${product.name} adicionado — ${qty} un.`,
    };
  };

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) return;
    const trimmed = code.trim();

    try {
      // Check if code is a GTIN CX (box barcode) in box mode
      if (boxModeEnabled) {
        const { data: boxProducts } = await supabase
          .from("products")
          .select("id, name, sku, barcode, stock_physical, gtin_cx, box_quantity")
          .eq("gtin_cx", trimmed);

        if (boxProducts && boxProducts.length > 0) {
          const product = boxProducts[0];
          // Auto-expand box config for this product
          const result = addOrIncrementItem(items, product, 1);
          if (result.added) {
            setItems(result.items);
            setExpandedBoxProduct(product.id);
            setBoxForm({
              gtinCx: product.gtin_cx || trimmed,
              unitsPerBox: product.box_quantity ? String(product.box_quantity) : "",
              boxCount: "1",
            });
            setLastScan({ success: true, message: `📦 Caixa detectada — "${product.name}". Configure a quantidade.` });
            playBeep(800, 100);
          } else {
            setLastScan({ success: false, message: result.message });
            playBeep(200, 400);
          }
          setScanBuffer("");
          setTimeout(() => scanInputRef.current?.focus(), 50);
          return;
        }
      }

      // 1. Check if code matches a Kit SKU
      const matchedKit = kits?.find((k) => k.sku.toLowerCase() === trimmed.toLowerCase() && k.active);
      if (matchedKit && matchedKit.kit_items && matchedKit.kit_items.length > 0) {
        const productIds = matchedKit.kit_items.map((ki) => ki.product_id);
        const { data: kitProducts } = await supabase
          .from("products")
          .select("id, name, sku, barcode, stock_physical")
          .in("id", productIds);

        if (!kitProducts || kitProducts.length === 0) {
          setLastScan({ success: false, message: `Produtos do kit "${matchedKit.name}" não encontrados.` });
          playBeep(200, 400);
          setScanBuffer("");
          setTimeout(() => scanInputRef.current?.focus(), 50);
          return;
        }

        let updatedItems = [...items];
        const addedNames: string[] = [];
        let hasError = false;

        for (const kitItem of matchedKit.kit_items) {
          const product = kitProducts.find((p) => p.id === kitItem.product_id);
          if (!product) { hasError = true; setLastScan({ success: false, message: `Produto do kit não encontrado.` }); break; }
          if (product.stock_physical < kitItem.quantity) { hasError = true; setLastScan({ success: false, message: `"${product.name}" sem estoque suficiente (necessário: ${kitItem.quantity}, disponível: ${product.stock_physical}).` }); break; }
          const result = addOrIncrementItem(updatedItems, product, kitItem.quantity);
          if (!result.added) { hasError = true; setLastScan({ success: false, message: result.message }); break; }
          updatedItems = result.items;
          addedNames.push(`${product.name} (${kitItem.quantity}x)`);
        }

        if (!hasError) {
          setItems(updatedItems);
          setUsedKits((prev) => prev.includes(matchedKit.name) ? prev : [...prev, matchedKit.name]);
          setLastScan({ success: true, message: `Kit "${matchedKit.name}" — ${addedNames.join(", ")}` });
          playBeep(800, 100);
        } else {
          playBeep(200, 400);
        }

        setScanBuffer("");
        setTimeout(() => scanInputRef.current?.focus(), 50);
        return;
      }

      // 2. Regular product scan
      const { data: products } = await supabase
        .from("products")
        .select("id, name, sku, barcode, stock_physical, gtin_cx, box_quantity")
        .or(`barcode.eq.${trimmed},sku.eq.${trimmed}`);

      const product = products?.[0];
      if (!product) {
        setLastScan({ success: false, message: `Produto "${trimmed}" não encontrado.` });
        playBeep(200, 400);
        setScanBuffer("");
        setTimeout(() => scanInputRef.current?.focus(), 50);
        return;
      }

      if (product.stock_physical <= 0) {
        setLastScan({ success: false, message: `"${product.name}" sem estoque físico disponível.` });
        playBeep(200, 400);
        setScanBuffer("");
        setTimeout(() => scanInputRef.current?.focus(), 50);
        return;
      }

      // Modo Ordem Ativa: incrementa qtd_bipada e valida com qtd_solicitada
      if (ordemAtiva) {
        const inOrdem = ordemAtiva.produtos.find((p) => p.product_id === product.id);
        if (!inOrdem) {
          const ok = window.confirm(`⚠️ "${product.name}" NÃO está na ordem ${ordemAtiva.numero}.\n\nDeseja adicionar mesmo assim?`);
          if (!ok) {
            setLastScan({ success: false, message: `Produto fora da ordem — ignorado.` });
            playBeep(300, 300);
            setScanBuffer("");
            setTimeout(() => scanInputRef.current?.focus(), 50);
            return;
          }
        }
        const result = addOrIncrementItem(items, product, 1);
        setItems(result.items);
        const newBipada = (qtdBipada[product.id] ?? 0) + 1;
        setQtdBipada({ ...qtdBipada, [product.id]: newBipada });
        if (inOrdem) {
          if (newBipada > inOrdem.qtd_solicitada) {
            setLastScan({ success: false, message: `⚠️ Excesso em "${product.name}" — ${newBipada}/${inOrdem.qtd_solicitada}` });
            playBeep(400, 200);
          } else {
            setLastScan({ success: true, message: `✓ ${product.name} — ${newBipada} de ${inOrdem.qtd_solicitada}` });
            playBeep(800, 100);
          }
        } else {
          setLastScan({ success: true, message: `${product.name} adicionado (fora da ordem) — ${newBipada} un.` });
          playBeep(800, 100);
        }
        setScanBuffer("");
        setTimeout(() => scanInputRef.current?.focus(), 50);
        return;
      }

      const result = addOrIncrementItem(items, product, 1);
      setItems(result.items);
      setLastScan({ success: result.added, message: result.message });
      playBeep(result.added ? 800 : 300, result.added ? 100 : 300);

      // If box mode is enabled, auto-expand box config
      if (boxModeEnabled && result.added) {
        setExpandedBoxProduct(product.id);
        setBoxForm({
          gtinCx: product.gtin_cx || "",
          unitsPerBox: product.box_quantity ? String(product.box_quantity) : "",
          boxCount: "1",
        });
      }
    } catch (err: any) {
      setLastScan({ success: false, message: err.message });
    }

    setScanBuffer("");
    setTimeout(() => scanInputRef.current?.focus(), 50);
  }, [items, kits, boxModeEnabled, ordemAtiva, qtdBipada]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan(scanBuffer);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setItems(items.map((i) => {
      if (i.productId !== productId) return i;
      const newQty = Math.max(1, Math.min(i.stockPhysical, i.quantity + delta));
      return { ...i, quantity: newQty };
    }));
  };

  const removeItem = (productId: string) => {
    setItems(items.filter((i) => i.productId !== productId));
    const newConfigs = { ...boxConfigs };
    delete newConfigs[productId];
    setBoxConfigs(newConfigs);
    if (expandedBoxProduct === productId) setExpandedBoxProduct(null);
  };

  const handleAddKit = async (kit: Kit) => {
    if (!kit.kit_items || kit.kit_items.length === 0) {
      toast({ title: "Kit sem itens cadastrados.", variant: "destructive" });
      return;
    }
    const productIds = kit.kit_items.map((ki) => ki.product_id);
    const { data: kitProducts } = await supabase.from("products").select("id, name, sku, barcode, stock_physical").in("id", productIds);
    if (!kitProducts) return;
    let updatedItems = [...items];
    for (const kitItem of kit.kit_items) {
      const product = kitProducts.find((p) => p.id === kitItem.product_id);
      if (!product) continue;
      const result = addOrIncrementItem(updatedItems, product, kitItem.quantity);
      updatedItems = result.items;
    }
    setItems(updatedItems);
    setUsedKits((prev) => prev.includes(kit.name) ? prev : [...prev, kit.name]);
    toast({ title: `Kit "${kit.name}" adicionado à lista de envio!` });
  };

  const handleApplyBoxConfig = (productId: string) => {
    const unitsPerBox = parseInt(boxForm.unitsPerBox) || 0;
    const boxCount = parseInt(boxForm.boxCount) || 0;
    if (unitsPerBox <= 0 || boxCount <= 0) {
      toast({ title: "Preencha unidades por caixa e quantidade de caixas.", variant: "destructive" });
      return;
    }
    const totalUnits = unitsPerBox * boxCount;
    const item = items.find((i) => i.productId === productId);
    if (!item) return;
    if (totalUnits > item.stockPhysical) {
      toast({ title: `Total (${totalUnits} un) excede estoque físico (${item.stockPhysical} un).`, variant: "destructive" });
      return;
    }

    setBoxConfigs({
      ...boxConfigs,
      [productId]: { productId, gtinCx: boxForm.gtinCx, unitsPerBox, boxCount },
    });
    setItems(items.map((i) => i.productId === productId ? { ...i, quantity: totalUnits } : i));
    setExpandedBoxProduct(null);
    toast({ title: `📦 ${boxCount} cx × ${unitsPerBox} un = ${totalUnits} un aplicado!` });
  };

  const generatePdf = (orderNumber: string, hasRecording: boolean): string => {
    const doc = new jsPDF();
    const now = new Date();
    doc.setFontSize(16);
    doc.text("Ordem de Envio FULL", 14, 18);
    doc.setFontSize(10);
    doc.text(`Nº da ordem: ${orderNumber}`, 14, 26);
    doc.text(`Data: ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR")}`, 14, 32);

    autoTable(doc, {
      startY: 40,
      head: [["Nome", "SKU", "EAN", "Qtd"]],
      body: items.map((i) => [i.productName, i.productSku, i.barcode || "-", String(i.quantity)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 40;
    doc.setFontSize(10);
    doc.text(`Total de itens: ${totalQty}`, 14, finalY + 10);
    if (totalBoxes > 0) doc.text(`Total de caixas: ${totalBoxes}`, 14, finalY + 16);
    doc.setFontSize(8);
    doc.text(`Gravação disponível: ${hasRecording ? "Sim" : "Não"}`, 14, finalY + 24);

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    // Auto-download
    const a = document.createElement("a");
    a.href = url;
    a.download = `OrdemFULL_${orderNumber}.pdf`;
    a.click();
    return url;
  };

  const handleCreateOrder = async () => {
    if (items.length === 0) return;
    const boxNotes = Object.values(boxConfigs).map((bc) => {
      const item = items.find((i) => i.productId === bc.productId);
      return item ? `${item.productName}: ${bc.boxCount}cx × ${bc.unitsPerBox}un = ${bc.boxCount * bc.unitsPerBox}un` : "";
    }).filter(Boolean);
    const kitNotes = usedKits.length > 0 ? `Kits: ${usedKits.join(", ")}` : "";
    const allNotes = [kitNotes, ...boxNotes].filter(Boolean).join(" | ");
    const order = await createOrder.mutateAsync({ items, notes: allNotes || undefined });

    const wasRecording = recorder.status === "recording" || recorder.status === "paused";
    const durationSec = recorder.seconds;
    let videoUrl: string | null = null;

    // Sobe gravação da separação se ativa
    if (order && wasRecording) {
      const blob = await recorder.stop();
      if (blob && blob.size > 0 && companyId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          try {
            const res = await recorder.uploadAndSave({
              blob, companyId, userId: user.id, envioId: order.id,
              orderNumber: order.order_number, tipo: "separacao", duracaoSegundos: durationSec,
            });
            videoUrl = res.url;
          } catch (e: any) {
            toast({ title: "Erro ao salvar gravação", description: e.message, variant: "destructive" });
          }
        }
      }
      recorder.reset();
    }

    const pdfBlobUrl = generatePdf(order.order_number, !!videoUrl);

    // Marca ordens carregadas (envio_pendente / ordem ativa) como enviadas
    for (const ordemId of loadedOrdemIds) {
      try { await marcarEnviada.mutateAsync(ordemId); } catch {}
    }
    if (ordemAtiva) {
      localStorage.removeItem("ordem_ativa");
      toast({ title: `✅ Ordem ${ordemAtiva.numero} enviada!` });
    }

    setSuccessInfo({ orderNumber: order.order_number, durationSec, videoUrl, pdfBlobUrl });
    setItems([]);
    setUsedKits([]);
    setBoxConfigs({});
    setLastScan(null);
    setAskedOnce(false);
    setLoadedOrdemIds([]);
    setOrdemAtiva(null);
    setQtdBipada({});
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

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalBoxes = Object.values(boxConfigs).reduce((sum, bc) => sum + bc.boxCount, 0);
  const activeKits = kits?.filter((k) => k.active && k.kit_items && k.kit_items.length > 0) || [];

  const statusFlow: Record<string, { next: string; label: string }> = {
    separando: { next: "enviado", label: "Marcar Enviado" },
    enviado: { next: "recebido_full", label: "Marcar Recebido" },
    recebido_full: { next: "conferido_full", label: "Confirmar FULL" },
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; class: string }> = {
      separando: { label: "Separando", class: "bg-muted text-muted-foreground" },
      enviado: { label: "Enviado", class: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
      recebido_full: { label: "Recebido", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
      conferido_full: { label: "Conferido", class: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
      cancelado: { label: "Cancelado", class: "bg-destructive/15 text-destructive" },
    };
    const s = map[status] || map.separando;
    return <Badge variant="outline" className={s.class}>{s.label}</Badge>;
  };

  const statCounts = {
    separando: orders?.filter((o) => o.status === "separando").length ?? 0,
    enviado: orders?.filter((o) => o.status === "enviado").length ?? 0,
    recebido: orders?.filter((o) => o.status === "recebido_full").length ?? 0,
    conferido: orders?.filter((o) => o.status === "conferido_full").length ?? 0,
  };

  const isRecording = recorder.status === "recording" || recorder.status === "paused";

  return (
    <div className="space-y-6">
      {/* Floating REC mini-preview */}
      {isRecording && (
        <div className="fixed top-20 right-6 z-50 rounded-lg border-2 border-red-500 bg-background shadow-2xl overflow-hidden">
          <div className="relative">
            <video
              ref={recorder.videoRef}
              autoPlay
              muted
              playsInline
              className={`object-cover bg-black transition-all ${previewExpanded ? "w-[320px] h-[180px]" : "w-[160px] h-[90px]"}`}
            />
            <Badge className="absolute top-1 left-1 bg-red-600 text-white border-none animate-pulse text-[10px] px-1.5 py-0">
              <Circle className="h-2 w-2 mr-1 fill-current" />
              {recordingMode === "despacho" ? "REC DESPACHO" : "REC"}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-1 right-1 h-6 w-6 bg-black/60 hover:bg-black/80 text-white"
              onClick={() => setPreviewExpanded((v) => !v)}
              title={previewExpanded ? "Minimizar" : "Expandir"}
            >
              {previewExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            <span className="absolute bottom-1 right-1 text-[10px] font-mono bg-black/70 text-white px-1.5 rounded">
              {formatDuration(recorder.seconds)}
            </span>
          </div>
          <div className="flex gap-1 p-1 bg-card">
            {recorder.status === "recording" ? (
              <Button size="sm" variant="ghost" className="h-7 flex-1 text-xs" onClick={recorder.pause}>
                <Pause className="h-3 w-3" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 flex-1 text-xs" onClick={recorder.resume}>
                <Play className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              className="h-7 flex-1 text-xs"
              onClick={async () => {
                if (recordingMode === "despacho" && despachoOrderId) {
                  await stopAndUpload(despachoOrderId.id, despachoOrderId.number, "despacho");
                  setDespachoOrderId(null);
                  return;
                }
                const blob = await recorder.stop();
                const dur = recorder.seconds;
                if (!blob || blob.size === 0 || !companyId) {
                  recorder.reset();
                  return;
                }
                const save = window.confirm(
                  `Deseja salvar a gravação (${formatDuration(dur)}) mesmo sem ordem vinculada?\n\nOK = Salvar  •  Cancelar = Descartar`
                );
                if (save) {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      await recorder.uploadStandalone({ blob, companyId, userId: user.id, duracaoSegundos: dur });
                      toast({ title: `📹 Gravação salva sem ordem (${formatDuration(dur)})` });
                    }
                  } catch (e: any) {
                    toast({ title: "Erro ao salvar gravação", description: e.message, variant: "destructive" });
                  }
                } else {
                  toast({ title: "Gravação descartada." });
                }
                recorder.reset();
              }}
            >
              <Square className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal: Deseja gravar? */}
      <Dialog open={showAskRecord} onOpenChange={setShowAskRecord}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>📹 Deseja gravar a {recordingMode === "despacho" ? "despacho" : "separação"}?</DialogTitle>
            <DialogDescription>
              Grave para ter prova em caso de divergências com o Mercado Livre.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAskRecord(false)}>Continuar sem gravar</Button>
            <Button onClick={openCameraPicker}>
              <Video className="mr-2 h-4 w-4" /> Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Seleção de câmera */}
      <Dialog open={showCameraPicker} onOpenChange={setShowCameraPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecione a câmera</DialogTitle>
            <DialogDescription>Escolha qual câmera usar para gravar.</DialogDescription>
          </DialogHeader>
          <Select value={selectedCamera} onValueChange={setSelectedCamera}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {recorder.cameras.map((c) => (
                <SelectItem key={c.deviceId} value={c.deviceId}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCameraPicker(false)}>Cancelar</Button>
            <Button onClick={startRecording} disabled={!selectedCamera}>
              <Circle className="mr-2 h-4 w-4 fill-red-500 text-red-500" /> Iniciar gravação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Sucesso ao gerar ordem */}
      <Dialog open={!!successInfo} onOpenChange={(o) => !o && setSuccessInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ Ordem gerada com sucesso!</DialogTitle>
            <DialogDescription>
              Nº da ordem: <span className="font-mono font-semibold">{successInfo?.orderNumber}</span>
              {successInfo?.videoUrl && (
                <span className="block mt-1">📹 Gravação salva: {formatDuration(successInfo.durationSec)}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-wrap">
            {successInfo?.pdfBlobUrl && (
              <Button variant="outline" onClick={() => {
                const a = document.createElement("a");
                a.href = successInfo.pdfBlobUrl;
                a.download = `OrdemFULL_${successInfo.orderNumber}.pdf`;
                a.click();
              }}>
                📄 Baixar PDF
              </Button>
            )}
            {successInfo?.videoUrl && (
              <Button variant="outline" onClick={() => window.open(successInfo.videoUrl!, "_blank")}>
                ▶️ Ver gravação
              </Button>
            )}
            <Button onClick={() => setSuccessInfo(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Movimentação Físico → FULL</h1>
        <p className="text-muted-foreground">Envie produtos do estoque físico para o FULL Mercado Livre</p>
      </div>

      <Tabs defaultValue="ordens" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ordens">📋 Ordens</TabsTrigger>
          <TabsTrigger value="envio">📦 Envio FULL</TabsTrigger>
          <TabsTrigger value="gravacoes">📹 Gravações</TabsTrigger>
        </TabsList>

        <TabsContent value="ordens" className="mt-0">
          <OrdensFullTab />
        </TabsContent>

        <TabsContent value="envio" className="space-y-6 mt-0">
          {/* Banner: Ordem ativa (vinda do clique em "Executar") */}
          {ordemAtiva && (() => {
            const total = ordemAtiva.produtos.length;
            const completos = ordemAtiva.produtos.filter((p) => (qtdBipada[p.product_id] ?? 0) >= p.qtd_solicitada && p.qtd_solicitada > 0).length;
            const allDone = total > 0 && completos === total;
            const pct = total > 0 ? Math.round((completos / total) * 100) : 0;
            return (
              <Card className={allDone ? "border-emerald-500/50 bg-emerald-500/10" : "border-blue-500/40 bg-blue-500/10"}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <ClipboardList className={`h-5 w-5 shrink-0 ${allDone ? "text-emerald-400" : "text-blue-400"}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${allDone ? "text-emerald-300" : "text-blue-300"}`}>
                          {allDone ? "✅ Todos os itens separados!" : `📋 Separando Ordem ${ordemAtiva.numero}`}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {ordemAtiva.descricao || "Sem descrição"} — {completos} de {total} produtos completos
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!window.confirm("Cancelar separação? O progresso será perdido.")) return;
                        try {
                          await updateStatusOrdem.mutateAsync({ id: ordemAtiva.id, status: "aguardando" });
                        } catch {}
                        localStorage.removeItem("ordem_ativa");
                        setOrdemAtiva(null);
                        setItems([]);
                        setQtdBipada({});
                        setLoadedOrdemIds([]);
                        toast({ title: "Separação cancelada." });
                      }}
                    >
                      <X className="h-4 w-4 mr-1" /> Cancelar separação
                    </Button>
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full transition-all ${allDone ? "bg-emerald-500" : "bg-blue-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Banner: envio_pendente legado */}
          {!ordemAtiva && loadedOrdemIds.length > 0 && envioPendente && envioPendente.length > 0 && (
            <Card className="border-blue-500/40 bg-blue-500/10">
              <CardContent className="flex items-center justify-between gap-3 p-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <ClipboardList className="h-5 w-5 text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-blue-300">
                      📋 Ordem{loadedOrdemIds.length > 1 ? "s" : ""}{" "}
                      {Array.from(new Set(envioPendente.map((ep: any) => ep.ordem?.numero).filter(Boolean))).join(", ")} carregada
                      {loadedOrdemIds.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {envioPendente.length} produto(s) prontos para envio — confira a lista abaixo e gere a ordem de envio FULL.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    for (const oid of loadedOrdemIds) {
                      try { await limparPendente.mutateAsync(oid); } catch {}
                    }
                    setItems([]);
                    setLoadedOrdemIds([]);
                    toast({ title: "Lista limpa." });
                  }}
                >
                  <X className="h-4 w-4 mr-1" /> Limpar
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg"><Package className="h-5 w-5 text-blue-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Produtos</p>
                  <p className="text-xl font-bold">{items.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg"><Boxes className="h-5 w-5 text-emerald-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Unidades</p>
                  <p className="text-xl font-bold">{totalQty}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg"><Truck className="h-5 w-5 text-amber-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Caixas</p>
                  <p className="text-xl font-bold">{totalBoxes}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg"><Video className="h-5 w-5 text-purple-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Status REC</p>
                  <p className="text-xl font-bold">{isRecording ? "Gravando" : "Ocioso"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ScanBarcode className="h-5 w-5 text-primary" /> Bipar Produtos para Envio
              </CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="box-mode" className="text-sm cursor-pointer">Modo Caixas</Label>
                <Switch id="box-mode" checked={boxModeEnabled} onCheckedChange={setBoxModeEnabled} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <BarcodeScannerInput
                    ref={scanInputRef}
                    value={scanBuffer}
                    onChange={setScanBuffer}
                    onScan={handleScan}
                    placeholder="Bipe o EAN ou SKU do produto..."
                    autoFocus
                  />
                </div>
                {lastScan && (
                  <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 animate-in fade-in slide-in-from-top-1 ${
                    lastScan.success ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}>
                    {lastScan.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <span className="text-sm font-medium">{lastScan.message}</span>
                  </div>
                )}
              </div>

              {items.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/30">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <ScanBarcode className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-medium">Nenhum item bipado</h3>
                  <p className="text-xs text-muted-foreground mt-1">Comece a bipar os produtos para preparar o envio FULL.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Produto / SKU</TableHead>
                        <TableHead className="text-center">Qtd</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell>
                            <div className="font-medium text-sm">{item.productName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{item.productSku}</div>
                            {item.barcode && <div className="text-[10px] text-muted-foreground">EAN: {item.barcode}</div>}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.productId, -1)}><Minus className="h-3 w-3" /></Button>
                              <span className="font-bold text-lg w-8">{item.quantity}</span>
                              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(item.productId, 1)}><Plus className="h-3 w-3" /></Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                             <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.productId)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {items.length > 0 && (
            <div className="flex justify-end gap-3">
               <Button variant="outline" onClick={() => { if(confirm("Limpar lista?")) setItems([]); setBoxConfigs({}); }}>Limpar Lista</Button>
               <Button size="lg" className="px-10 gap-2" onClick={handleCreateOrder} disabled={createOrder.isPending}>
                 {createOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                 Gerar Ordem de Envio FULL
               </Button>
            </div>
          )}

          {/* Lista de Ordens Recentes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" /> Histórico Recente de Envios
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders && orders.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Nº Ordem</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.slice(0, 10).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>{statusBadge(order.status)}</TableCell>
                          <TableCell className="text-right">
                             <Button size="sm" variant="ghost" onClick={() => {
                               setRecordingMode("despacho");
                               setDespachoOrderId({ id: order.id, number: order.order_number });
                               setShowAskRecord(true);
                             }}>
                               <Video className="h-4 w-4 text-red-500 mr-1" /> Gravar Despacho
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-6 text-muted-foreground">Nenhum envio realizado recentemente.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gravacoes" className="mt-0">
          <GravacoesFullTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MovimentacaoFull;
