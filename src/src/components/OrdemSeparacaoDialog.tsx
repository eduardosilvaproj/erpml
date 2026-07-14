import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanBarcode, Video, Square, Circle, CheckCircle2, AlertTriangle, Loader2, Play, Printer, Box, Clock, Calendar, ArrowRight, Truck, Boxes } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyId } from "@/hooks/useCompanyId";
import {
  useOrdemFull, useUpdateItemQuantity, useUpdateOrdemStatus, useMarcarOrdemSeparada, useMarcarOrdemEnviada,
  itemStatusBadge, ordemStatusBadge, type OrdemItem, useUpdateFullOrder
} from "@/hooks/useOrdensFull";
import { useFullRecorder, formatDuration } from "@/hooks/useFullRecorder";
import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { useNavigate } from "react-router-dom";
import { OrderRecordingSystem } from "@/components/OrderRecordingSystem";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  ordemId: string | null;
  onClose: () => void;
}

export const OrdemSeparacaoDialog = ({ ordemId, onClose }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { data, isLoading, refetch } = useOrdemFull(ordemId);
  const updateItem = useUpdateItemQuantity();
  const updateStatus = useUpdateOrdemStatus();
  const marcarSeparada = useMarcarOrdemSeparada();
  const marcarEnviada = useMarcarOrdemEnviada();
  const updateFullOrder = useUpdateFullOrder();
  const recorder = useFullRecorder();
  const scannerRef = useRef<any>(null);
  const internalScannerRef = useRef<any>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const [askRecord, setAskRecord] = useState(false);
  const [pickCamera, setPickCamera] = useState(false);
  const [selCam, setSelCam] = useState<string>("");
  const [scan, setScan] = useState("");
  const [lastScan, setLastScan] = useState<{ ok: boolean; msg: string } | null>(null);
  const [editingPrevisao, setEditingPrevisao] = useState(false);
  const [novaPrevisaoData, setNovaPrevisaoData] = useState("");
  const [novaPrevisaoHora, setNovaPrevisaoHora] = useState("");
  const [responsavelNome, setResponsavelNome] = useState<string | null>(null);
  const [showConfirmFinalizar, setShowConfirmFinalizar] = useState(false);
  const [boxMode, setBoxMode] = useState<"idle" | "ask" | "qty" | "scan_internal">("idle");
  const [tempBoxCode, setTempBoxCode] = useState("");
  const [tempBoxQty, setTempBoxQty] = useState("12");
  const [internalScan, setInternalScan] = useState("");
  const [knownBoxProduct, setKnownBoxProduct] = useState<OrdemItem | null>(null);
  const [blockingAlert, setBlockingAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  const ordem = data?.ordem;
  const itens = data?.itens || [];
  const isExec = ordem?.status === "em_separacao";
  const isSeparada = ordem?.status === "separada" || ordem?.status === "aguardando_carregamento" || ordem?.status === "carregando";
  const isLoadingPhase = ordem?.status === 'aguardando_carregamento' || ordem?.status === 'carregando';
  const isView = ordem?.status === "concluida" || ordem?.status === "enviado" || ordem?.status === "cancelada" || (isSeparada && !isLoadingPhase);

  useEffect(() => {
    if (ordem) {
      if (ordem.separado_por_profile?.full_name) {
        setResponsavelNome(ordem.separado_por_profile.full_name);
      } else if (ordem.atribuido?.full_name) {
        setResponsavelNome(ordem.atribuido.full_name);
      } else if (ordem.separado_por) {
        setResponsavelNome("Usuário " + ordem.separado_por.slice(0, 8));
      } else {
        setResponsavelNome("Administrador");
      }
    }
  }, [ordem]);


  useEffect(() => {
    if (!ordemId) {
      setAskRecord(false); setPickCamera(false); setSelCam(""); setScan(""); setLastScan(null);
      setEditingPrevisao(false);
      if (recorder.status !== "idle") recorder.reset();
    } else if (ordem?.previsao_carregamento) {
      const d = new Date(ordem.previsao_carregamento);
      setNovaPrevisaoData(format(d, "yyyy-MM-dd"));
      setNovaPrevisaoHora(format(d, "HH:mm"));
    }
  }, [ordemId, ordem?.previsao_carregamento]);

  useEffect(() => {
    if (boxMode === "qty") {
      setTimeout(() => qtyInputRef.current?.focus(), 150);
    } else if (boxMode === "scan_internal") {
      setTimeout(() => internalScannerRef.current?.focus(), 150);
    }
  }, [boxMode]);

  useEffect(() => {
    if (boxMode === "idle" && isExec && !isLoadingPhase) {
      setTimeout(() => scannerRef.current?.focus(), 150);
    }
  }, [boxMode, isExec, isLoadingPhase]);

  const progress = useMemo(() => {
    const total = itens.reduce((s, i) => s + i.qtd_solicitada, 0);
    const sep = itens.reduce((s, i) => s + Math.min(i.qtd_separada, i.qtd_solicitada), 0);
    const completos = itens.filter((i) => i.status === "completo").length;
    return { total, sep, completos, pct: total > 0 ? Math.round((sep / total) * 100) : 0 };
  }, [itens]);

  const allComplete = itens.length > 0 && itens.every((i) => i.status === "completo");

  const handleStart = () => setAskRecord(true);

  const startWithoutRecording = async () => {
    setAskRecord(false);
    if (!ordem) return;
    await updateStatus.mutateAsync({ id: ordem.id, status: "em_separacao" });
    refetch();
  };

  const startWithRecording = async () => {
    setAskRecord(false);
    const list = await recorder.listCameras();
    if (list.length === 0) {
      toast({ title: "Sem câmera detectada", variant: "destructive" });
      return;
    }
    setSelCam(list[0].deviceId);
    setPickCamera(true);
  };

  const confirmStartRecording = async () => {
    setPickCamera(false);
    if (!ordem) return;
    await recorder.start(selCam);
    await updateStatus.mutateAsync({ id: ordem.id, status: "em_separacao" });
    refetch();
  };

  const confirmBox = async (target: OrdemItem, quantity: number) => {
    const newQtd = (target.qtd_separada || 0) + quantity;
    
    if (newQtd > (target.qtd_solicitada || 0)) {
      setBlockingAlert({
        isOpen: true,
        title: "⚠️ Quantidade Excedida",
        message: `A caixa com ${quantity} unidades excede a quantidade restante para este produto! (${target.qtd_separada} de ${target.qtd_solicitada} bipados)`
      });
      setScan("");
      setInternalScan("");
      return;
    }

    setBoxMode("idle");
    setScan("");
    setInternalScan("");
    setKnownBoxProduct(null);
    setLastScan({ ok: true, msg: `📦 Caixa de ${quantity}x ${target.product?.name} registrada!` });

    await updateItem.mutateAsync({
      itemId: target.id,
      qtd_separada: newQtd,
      qtd_solicitada: target.qtd_solicitada || 0,
      orderId: ordem?.id,
    });
    refetch();
  };

  const handleScan = async (code: string) => {
    if (!code.trim() || !isExec) return;

    // Se estivermos esperando o produto interno da caixa
    if (boxMode === "scan_internal") {
      const internalCode = code.trim().toUpperCase();
      const target = itens.find((i) =>
        i.product?.ean === internalCode || i.product?.barcode === internalCode || i.product?.sku === internalCode
      );

      if (target) {
        const qtyToLow = parseInt(tempBoxQty);
        await confirmBox(target, qtyToLow);
      } else {
        setBlockingAlert({
          isOpen: true,
          title: "🚫 Produto Inválido",
          message: "O produto interno da caixa não pertence a esta ordem! Verifique o item e tente novamente."
        });
        setScan("");
        setInternalScan("");
      }
      return;
    }

    const codeTrimmed = code.trim();

    // 1. PRIORIDADE: EAN/Barcode Unitário (Unidade)
    const target = itens.find((i) =>
      i.product?.ean === codeTrimmed || i.product?.barcode === codeTrimmed || i.product?.sku === codeTrimmed
    );

    if (target) {
      const newQtd = (target.qtd_separada || 0) + 1;
      if (newQtd > (target.qtd_solicitada || 0)) {
        setBlockingAlert({
          isOpen: true,
          title: "Produto já completo!",
          message: `${target.product?.name} já atingiu a quantidade necessária. Verifique o item.`
        });
        setScan("");
        return;
      }

      setLastScan({ ok: true, msg: `${target.product?.name} — ${newQtd}/${target.qtd_solicitada}` });
      
      await updateItem.mutateAsync({
        itemId: target.id,
        qtd_separada: newQtd,
        qtd_solicitada: target.qtd_solicitada || 0,
        orderId: ordem?.id,
      });
      refetch();
      setScan("");
      return;
    }

    // 2. FALLBACK 1: GTIN de Caixa (gtin_cx)
    const targetInOrderBox = itens.find(i => (i.product as any)?.gtin_cx === codeTrimmed);
    
    if (targetInOrderBox) {
      setTempBoxCode(codeTrimmed);
      setTempBoxQty(((targetInOrderBox.product as any)?.box_quantity || 0).toString());
      setKnownBoxProduct(targetInOrderBox);
      setBoxMode("qty");
      setScan("");
      return;
    }

    // 3. FALLBACK 2: GTINs extras (product_gtins)
    // Buscamos no banco geral para ver se esse código pertence a algum produto da ordem
    const { data: gtinInfo } = await supabase
      .from("product_gtins")
      .select("product_id, gtin, tipo, box_quantity")
      .eq("company_id", companyId)
      .eq("gtin", codeTrimmed)
      .maybeSingle();

    if (gtinInfo) {
      const inOrder = itens.find(i => i.product?.id === gtinInfo.product_id);
      if (inOrder) {
        setTempBoxCode(codeTrimmed);
        setTempBoxQty((gtinInfo.box_quantity || 0).toString());
        setKnownBoxProduct(inOrder);
        setBoxMode("qty");
        setScan("");
        return;
      }
    }

    // 4. FALLBACK 3: EAN Genérico (product_alternative_gtins)
    const { data: genericInfo } = await supabase
      .from("product_alternative_gtins")
      .select("product_id, gtin")
      .eq("company_id", companyId)
      .eq("gtin", codeTrimmed)
      .maybeSingle();

    if (genericInfo) {
      const inOrder = itens.find(i => i.product?.id === (genericInfo as any).product_id);
      if (inOrder) {
        // Tratar como bipe de unidade do produto correspondente
        await handleScan(inOrder.product?.ean || inOrder.product?.barcode || inOrder.product?.sku || "");
        return;

      }
    }

    // 5. FALLBACK 4: Kit por EAN ou SKU (product_kits)
    let kitInfo: any = null;
    let kitErr: any = null;
    try {
      const res = await supabase
        .from("product_kits")
        .select("id, name, sku, ean, kit_items(product_id, quantity, products(id, name, sku, ean, barcode))")
        .eq("company_id", companyId)
        .eq("active", true)
        .or(`ean.eq.${codeTrimmed},sku.eq.${codeTrimmed}`)
        .maybeSingle();
      kitInfo = res.data;
      kitErr = res.error;
    } catch (e) {
      kitErr = e;
    }

    if (kitErr) {
      console.error("[KIT SCAN] erro na query product_kits:", kitErr);
      setBlockingAlert({
        isOpen: true,
        title: "Erro ao buscar kit",
        message: `Falha na consulta: ${kitErr.message || JSON.stringify(kitErr)}`
      });
      setScan("");
      return;
    }

    if (kitInfo && kitInfo.kit_items && kitInfo.kit_items.length > 0) {
      const kitItems = kitInfo.kit_items as any[];
      const matchingItens: any[] = [];

      for (const ki of kitItems) {
        const itemNaOrdem = itens.find(i =>
          i.product?.id === ki.product_id ||
          i.product?.ean === ki.products?.ean ||
          i.product?.barcode === ki.products?.barcode ||
          i.product?.sku === ki.products?.sku
        );
        if (itemNaOrdem) matchingItens.push(itemNaOrdem);
      }

      if (matchingItens.length > 0) {
        for (const item of matchingItens) {
          const kitItem = kitItems.find((ki: any) => ki.product_id === item.product?.id);
          const qtyToAdd = kitItem?.quantity || 1;
          const newQtd = (item.qtd_separada || 0) + qtyToAdd;
          if (newQtd > (item.qtd_solicitada || 0)) {
            setBlockingAlert({
              isOpen: true,
              title: "Quantidade Excedida",
              message: `Kit "${kitInfo.name}": "${item.product?.name}" atingiria ${newQtd} (solicitado: ${item.qtd_solicitada}).`
            });
            setScan("");
            return;
          }
          await updateItem.mutateAsync({
            itemId: item.id,
            qtd_separada: newQtd,
            qtd_solicitada: item.qtd_solicitada || 0,
            orderId: ordem?.id,
          });
        }
        setLastScan({
          ok: true,
          msg: `📦 Kit "${kitInfo.name}" bipado! ${matchingItens.length} item(ns) atualizado(s).`
        });
        refetch();
        setScan("");
        return;
      } else {
        setBlockingAlert({
          isOpen: true,
          title: "Kit Não Encontrado na Ordem",
          message: `O kit "${kitInfo.name}" (código: ${codeTrimmed}) não corresponde a nenhum item desta ordem. Itens do kit: ${kitItems.map((ki: any) => ki.products?.name || ki.product_id).join(", ")}.`
        });
        setScan("");
        return;
      }
    }


    // Se não encontrou nada, abre o modo de quantidade manual como último recurso (tratado como desconhecido)
    setTempBoxCode(codeTrimmed);
    setTempBoxQty("");
    setKnownBoxProduct(null);
    setBoxMode("qty");
    setScan("");
  };

  const executeFinalizar = async () => {
    if (!ordem || !user || !companyId) return;
    try {
      if (recorder.status === "recording" || recorder.status === "paused") {
        const blob = await recorder.stop();
        if (blob) {
          await recorder.uploadAndSave({
            blob, companyId, userId: user.id,
            envioId: ordem.id, orderNumber: ordem.numero,
            tipo: "separacao",
            duracaoSegundos: recorder.seconds,
          });
        }
      }
      await marcarSeparada.mutateAsync(ordem.id);
      toast({ title: "✅ Separação concluída!", description: "Produtos carregados para envio." });
      onClose();
      navigate("/movimentacao-full");
    } catch (e: any) {
      toast({ title: "Erro ao concluir", description: e.message, variant: "destructive" });
    }
  };

  const finalizar = async () => {
    if (!ordem || !user || !companyId) return;
    if (!allComplete) {
      setShowConfirmFinalizar(true);
      return;
    }
    await executeFinalizar();
  };

  const marcarComoEnviado = async () => {
    if (!ordem || !user || !companyId) return;
    try {
      if (recorder.status === "recording" || recorder.status === "paused") {
        const blob = await recorder.stop();
        if (blob) {
          await recorder.uploadAndSave({
            blob, companyId, userId: user.id,
            envioId: ordem.id, orderNumber: ordem.numero,
            tipo: "despacho",
            duracaoSegundos: recorder.seconds,
          });
        }
      }
      await marcarEnviada.mutateAsync(ordem.id);
      toast({ title: "✅ Ordem enviada!", description: "A ordem foi marcada como enviada ao FULL." });
      onClose();
      navigate("/movimentacao-full");
    } catch (e: any) {
      toast({ title: "Erro ao marcar como enviado", description: e.message, variant: "destructive" });
    }
  };

  const handleSavePrevisao = async () => {
    if (!ordem?.frete_ml) return;
    try {
      const novaData = new Date(`${novaPrevisaoData}T${novaPrevisaoHora}:00`).toISOString();
      const { error: e2 } = await supabase
        .from('full_orders')
        .update({ previsao_carregamento: novaData })
        .eq('id', ordem.id)
        .eq('company_id', companyId);
      if (e2) throw e2;
      toast({ title: '✅ Previsão atualizada' });
      setEditingPrevisao(false);
      refetch();
    } catch (e: any) {
      toast({ title: "Erro ao salvar previsão", description: e.message, variant: "destructive" });
    }
  };

  const ajustarQtd = async (item: OrdemItem, delta: number) => {
    const newQtd = Math.max(0, (item.qtd_separada || 0) + delta);
    await updateItem.mutateAsync({
      itemId: item.id,
      qtd_separada: newQtd,
      qtd_solicitada: item.qtd_solicitada || 0,
      orderId: ordem?.id,
    });
    refetch();
  };

  if (!ordemId) return null;

  return (
    <>
      <Dialog open={!!ordemId} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-hidden p-0 flex flex-col">
          {/* Header Fixo */}
          <div className="shrink-0 border-b">
            <div className="bg-gray-50 p-6">
              <div className="flex items-center justify-between max-w-2xl mx-auto">
                {[
                  { label: 'PDF', icon: Box, active: true },
                  { label: 'Separado', icon: CheckCircle2, active: (ordem?.status === 'separada' || ordem?.status === 'aguardando_carregamento' || ordem?.status === 'carregando' || ordem?.status === 'enviado' || ordem?.status === 'concluida') },
                  { label: 'Carregamento', icon: Truck, active: (ordem?.status === 'carregando' || ordem?.status === 'enviado' || ordem?.status === 'concluida') },
                  { label: 'Enviado', icon: CheckCircle2, active: (ordem?.status === 'enviado' || ordem?.status === 'concluida') }
                ].map((step, idx, arr) => (
                  <div key={step.label} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center relative">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs z-10 border-2 transition-all ${
                        step.active 
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' 
                          : 'bg-white border-gray-200 text-gray-400'
                      }`}>
                        <step.icon className="h-4 w-4" />
                      </div>
                      <span className={`text-[10px] mt-1 font-bold uppercase ${step.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 -mt-4 transition-all ${
                        arr[idx+1].active ? 'bg-emerald-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 pt-6">
              <DialogHeader>
                <DialogTitle className="flex flex-col gap-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-2xl font-black text-primary">Frete #{ordem?.frete_ml || "—"}</span>
                    <div className="flex gap-2">
                      {ordem && <Badge variant="outline" className={`${ordemStatusBadge(ordem.status as any).cls} px-3 py-1 text-xs font-bold uppercase`}>
                        {ordem.status === 'aguardando_carregamento' ? '🚛 Aguardando Carregamento' : ordemStatusBadge(ordem.status as any).label}
                      </Badge>}
                      {recorder.status === "recording" && (
                        <Badge variant="outline" className="bg-destructive/15 text-destructive animate-pulse">
                          <Circle className="h-2 w-2 mr-1 fill-current" /> REC {formatDuration(recorder.seconds)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground uppercase">ID Interno: {(ordem as any)?.ordem_id || ordem?.numero}</span>
                </DialogTitle>
              </DialogHeader>
            </div>
          </div>

          {/* Body Rolável */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-6">
            {!isLoading && ordem && (
              <DialogDescription className="text-base space-y-4">
                <div className="flex flex-col gap-4 py-4 border-y border-dashed mt-4">
                  <p className="font-bold text-lg">{ordem?.descricao || "Sem descrição"}</p>
                  
                  <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-800 font-bold mb-3">
                      <Calendar className="h-5 w-5" />
                      <span>📅 Previsão de coleta:</span>
                    </div>
                    
                    {editingPrevisao ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input 
                          type="date" 
                          className="w-40 bg-white" 
                          value={novaPrevisaoData} 
                          onChange={(e) => setNovaPrevisaoData(e.target.value)}
                        />
                        <Input 
                          type="time" 
                          className="w-28 bg-white" 
                          value={novaPrevisaoHora} 
                          onChange={(e) => setNovaPrevisaoHora(e.target.value)}
                        />
                        <Button size="sm" onClick={handleSavePrevisao} className="bg-blue-600 hover:bg-blue-700">Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingPrevisao(false)}>Cancelar</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-blue-900 bg-white px-3 py-1 rounded border shadow-sm">
                          {ordem?.previsao_carregamento && !isNaN(new Date(ordem.previsao_carregamento).getTime())
                            ? format(new Date(ordem.previsao_carregamento), "dd/MM/yyyy")
                            : "—"}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setEditingPrevisao(true)} className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
                          ✏️ Editar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </DialogDescription>
            )}

            {isLoading ? (
              <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : !ordem ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Ordem não encontrada</p>
            ) : (
              <div className="space-y-4">
                {!isLoadingPhase ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{progress.completos} de {itens.length} produtos completos</span>
                        <span className="font-medium">{progress.sep}/{progress.total} unidades ({progress.pct}%)</span>
                      </div>
                      <Progress value={progress.pct} className="h-2" />
                    </div>

                    {allComplete && (isExec || (isSeparada && !isLoadingPhase)) && (
                      <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-lg p-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Bipagem concluída!</p>
                            <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">Todos os itens desta ordem foram bipados com sucesso.</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={marcarComoEnviado}
                          disabled={marcarEnviada.isPending}
                          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-sm"
                        >
                          {marcarEnviada.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Marcar como enviado
                        </Button>
                      </div>
                    )}

                    {ordem.status === "aguardando" && (
                      <div className="text-center py-4">
                        <Button size="lg" onClick={handleStart}>
                          <Play className="h-4 w-4 mr-2" /> Iniciar separação
                        </Button>
                      </div>
                    )}

                    {isExec && (
                      <div className="flex flex-col xl:flex-row gap-4 xl:gap-6">
                        <div className="flex-1 min-w-0 order-2 xl:order-1 overflow-x-auto">
                          <ItensTable itens={itens} onAdjust={ajustarQtd} />
                        </div>
                        
                        <div className="w-full xl:w-[350px] shrink-0 order-1 xl:order-2 space-y-4">
                          <div className="bg-white border rounded-xl p-4 shadow-sm space-y-3">
                            <p className="text-sm font-bold flex items-center gap-2 text-primary">
                              <ScanBarcode className="h-4 w-4" /> BIPAR PRODUTO
                            </p>
                            <BarcodeScannerInput
                              ref={scannerRef}
                              value={scan}
                              onChange={setScan}
                              onScan={handleScan}
                              placeholder="Bipe o código..."
                              autoFocus
                              scanMode
                              disabled={blockingAlert.isOpen}
                              inputClassName="text-gray-900 border-2 focus:ring-primary"
                            />
                            {lastScan && (
                              <div className={`text-xs p-3 rounded-lg font-medium animate-in fade-in slide-in-from-top-1 ${
                                lastScan.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-destructive/10 text-destructive border border-destructive/20"
                              }`}>
                                {lastScan.ok ? <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" /> : <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5" />}
                                {lastScan.msg}
                              </div>
                            )}
                          </div>

                          {recorder.status === "recording" && (
                            <div className="bg-black rounded-xl border-2 border-destructive overflow-hidden shadow-xl aspect-video relative group w-full max-w-[500px] mx-auto xl:max-w-none">
                              <video 
                                ref={recorder.videoRef} 
                                className="w-full h-full object-cover" 
                                autoPlay 
                                muted 
                                playsInline
                              />
                              <div className="absolute top-2 left-2 px-2 py-0.5 bg-destructive text-white text-[10px] font-bold rounded flex items-center gap-1 animate-pulse">
                                <Circle className="h-2 w-2 fill-current" /> REC
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {isView && <ItensTable itens={itens} readonly />}
                  </>
                ) : (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-gray-50 px-4 py-2 border-b">
                        <h3 className="text-sm font-black flex items-center gap-2 text-gray-700">
                          <Box className="h-4 w-4" /> 📦 RESUMO DA SEPARAÇÃO
                        </h3>
                      </div>
                      <div className="p-6">
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                                <Boxes className="h-6 w-6" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground leading-none mb-1">Total Separado</p>
                                <p className="text-lg font-black text-gray-900">
                                  {ordem.total_produtos} produtos · {ordem.total_itens} unidades
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-amber-50 rounded-full text-amber-600">
                                <Clock className="h-6 w-6" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground leading-none mb-1">Data/Hora</p>
                                <p className="text-base font-bold text-gray-900">
                                  {ordem.separado_em ? format(new Date(ordem.separado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "Não registrada"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
                                <CheckCircle2 className="h-6 w-6" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground leading-none mb-1">Responsável</p>
                                <p className="text-base font-bold text-gray-900">
                                  {responsavelNome || "Administrador"}
                                </p>
                              </div>
                            </div>

                            <Button variant="outline" className="w-full sm:w-auto gap-2 border-dashed h-12" onClick={() => window.print()}>
                              <Printer className="h-5 w-5" /> Ver/Imprimir Relatório
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-black flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary" /> 🚛 GRAVAÇÃO DO CARREGAMENTO
                      </h3>
                      
                      <div className="flex flex-col items-center justify-center p-3 sm:p-10 border-2 border-dashed rounded-2xl bg-muted/20 gap-6 overflow-hidden">
                        {recorder.status === "recording" ? (
                          <div className="w-full max-w-lg space-y-4">
                            <div className="relative rounded-2xl border-4 border-destructive shadow-2xl bg-black aspect-video overflow-hidden w-full">
                              <video 
                                ref={recorder.videoRef} 
                                className="w-full h-full object-cover" 
                                autoPlay 
                                muted 
                                playsInline
                              />
                              <div className="absolute top-4 left-4 px-3 py-1 bg-destructive text-white rounded-full font-black flex items-center gap-2 animate-pulse shadow-lg">
                                <Circle className="h-3 w-3 fill-current" /> REC {formatDuration(recorder.seconds)}
                              </div>
                            </div>
                            <div className="flex items-center justify-center">
                              <Button 
                                variant="destructive" 
                                size="lg" 
                                className="rounded-full h-16 w-16 p-0 shadow-xl hover:scale-110 transition-transform border-4 border-white" 
                                onClick={() => recorder.stop()}
                              >
                                <Square className="h-8 w-8 fill-current" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full max-w-4xl mx-auto flex justify-center">
                            <OrderRecordingSystem 
                              pedidoId={ordem.id} 
                              orderNumber={ordem.frete_ml || ordem.numero} 
                              trigger={
                                <Button 
                                  size="lg"
                                  className="h-24 w-full rounded-2xl gap-4 bg-orange-600 hover:bg-orange-700 text-white font-black text-xl shadow-xl shadow-orange-600/30 group transition-all hover:scale-[1.02]"
                                >
                                  <div className="bg-white/20 p-3 rounded-full group-hover:bg-white/30 transition-colors">
                                    <Video className="h-8 w-8" />
                                  </div>
                                  🎥 Gravar Carregamento
                                </Button>
                              }
                            />
                          </div>
                        )}

                        <div className="text-center">
                          <p className="text-sm font-bold text-muted-foreground">Status da Câmera: <span className="text-emerald-600">Pronta para gravar</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 flex flex-col sm:flex-row sm:justify-between gap-3 p-6 border-t bg-gray-50/50">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} className="gap-2">
                <ArrowRight className="h-4 w-4 rotate-180" /> Fechar
              </Button>
              {isView && (
                <Button variant="outline" className="gap-2" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Imprimir Relatório
                </Button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {(isSeparada || isLoadingPhase) && (
                <Button 
                  onClick={marcarComoEnviado} 
                  disabled={marcarEnviada.isPending} 
                  className="gap-2 h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-lg shadow-emerald-500/20 font-black uppercase tracking-tight"
                >
                  {marcarEnviada.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="h-5 w-5" /> Marcar como Enviado
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={askRecord} onOpenChange={setAskRecord}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deseja gravar esta separação?</DialogTitle>
            <DialogDescription>A gravação ajuda em auditorias e disputas.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button onClick={startWithRecording}>
              <Video className="h-4 w-4 mr-2" /> Gravar e iniciar
            </Button>
            <Button variant="outline" onClick={startWithoutRecording}>Iniciar sem gravação</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pickCamera} onOpenChange={setPickCamera}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecionar câmera</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {recorder.cameras.map((c) => (
              <Button key={c.deviceId} variant={selCam === c.deviceId ? "default" : "outline"} className="w-full justify-start" onClick={() => setSelCam(c.deviceId)}>
                {c.label}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickCamera(false)}>Cancelar</Button>
            <Button onClick={confirmStartRecording} disabled={!selCam}>
              <Video className="h-4 w-4 mr-1" /> Começar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={boxMode !== "idle"} onOpenChange={(open) => {
        if (!open) {
          setBoxMode("idle");
          setInternalScan("");
          setKnownBoxProduct(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Box className="h-5 w-5 text-blue-500" />
              {knownBoxProduct ? `Caixa: ${knownBoxProduct.product?.name}` : `Fluxo de Caixa: ${tempBoxCode}`}
            </DialogTitle>
          </DialogHeader>

          {boxMode === "ask" && (
            <div className="py-6 space-y-4 text-center">
              <p className="font-medium text-lg">Este código é de uma CAIXA?</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="default" className="h-14 bg-blue-600 hover:bg-blue-700" onClick={() => setBoxMode("qty")}>
                  Sim, é uma caixa
                </Button>
                <Button variant="outline" className="h-14" onClick={() => {
                  setBoxMode("idle");
                  setLastScan({ ok: false, msg: `Produto "${tempBoxCode}" não está nesta ordem` });
                }}>
                  Não, cancelar
                </Button>
              </div>
            </div>
          )}

          {boxMode === "qty" && (
            <div className="py-6 space-y-4">
              {knownBoxProduct && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2 animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Box className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-emerald-800 uppercase tracking-wider">📦 Produto Identificado</p>
                      <p className="text-sm font-bold text-emerald-900">{knownBoxProduct.product?.name}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium">Quantos itens tem nesta caixa?</p>
                <Input
                  ref={qtyInputRef}
                  type="number"
                  value={tempBoxQty}
                  onChange={(e) => setTempBoxQty(e.target.value)}
                  autoFocus
                  className="h-12 text-lg font-bold"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (knownBoxProduct) {
                        confirmBox(knownBoxProduct, parseInt(tempBoxQty));
                      } else {
                        setBoxMode("scan_internal");
                      }
                    }
                  }}
                />
              </div>
              <Button 
                className={`w-full h-12 text-base font-black uppercase tracking-tight shadow-lg ${knownBoxProduct ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`} 
                onClick={() => {
                  if (knownBoxProduct) {
                    confirmBox(knownBoxProduct, parseInt(tempBoxQty));
                  } else {
                    setBoxMode("scan_internal");
                  }
                }}
              >
                {knownBoxProduct ? "Confirmar e Registrar Baixa" : "Confirmar Quantidade"}
              </Button>
            </div>
          )}

          {boxMode === "scan_internal" && (
            <div className="py-6 space-y-6">
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center animate-pulse">
                  <ScanBarcode className="h-8 w-8 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-blue-900">Aguardando leitura...</p>
                  <p className="text-sm text-muted-foreground">Bipe o EAN/SKU do produto que está <br/> dentro desta caixa de {tempBoxQty} unidades.</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Campo de Bipagem</Label>
                  <BarcodeScannerInput
                    ref={internalScannerRef}
                    value={internalScan}
                    onScan={handleScan}
                    onChange={setInternalScan}
                    placeholder="Bipe o código do item da caixa..."
                    autoFocus
                    scanMode
                    className="h-12"
                    inputClassName="h-12 text-lg text-center font-mono border-2 focus:border-blue-500 bg-white text-gray-900"
                  />
                </div>
                
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Ou selecione um item da ordem:</p>
                  <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1">
                    {itens.filter(i => (i.qtd_solicitada || 0) - (i.qtd_separada || 0) > 0).map(item => (
                      <Button
                        key={item.id}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 gap-3 text-left hover:bg-blue-50 hover:border-blue-200"
                        onClick={() => {
                          handleScan(item.product?.barcode || item.product?.sku || item.sku);
                        }}
                      >
                        {item.product?.image_url ? (
                          <img src={item.product.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><Box className="h-5 w-5 opacity-20" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{item.product?.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.product?.sku}</p>
                        </div>
                        <div className="text-xs font-black bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          Faltam: {(item.qtd_solicitada || 0) - (item.qtd_separada || 0)}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setBoxMode("qty")}>
                    Voltar
                  </Button>
                  <Button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 font-bold" 
                    onClick={() => {
                      if (internalScan.trim()) {
                        handleScan(internalScan);
                        setInternalScan("");
                      }
                    }}
                  >
                    Confirmar Lançamento
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmFinalizar} onOpenChange={setShowConfirmFinalizar}>
        <DialogContent className="sm:max-w-[425px] text-center p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="text-6xl mb-2 text-amber-500">⚠️</div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center">Itens Pendentes</DialogTitle>
              <DialogDescription className="text-base text-center pt-2">
                Existem itens pendentes/parciais nesta ordem.
              </DialogDescription>
            </DialogHeader>
            <p className="text-muted-foreground pt-2">Deseja marcar como separada mesmo assim?</p>
            
            <div className="flex flex-col w-full gap-3 pt-4">
              <Button onClick={() => { setShowConfirmFinalizar(false); executeFinalizar(); }} className="w-full py-6 text-base gap-2 bg-amber-600 hover:bg-amber-700">
                ✅ Sim, finalizar mesmo assim
              </Button>
              <Button variant="outline" onClick={() => setShowConfirmFinalizar(false)} className="w-full py-6 text-base gap-2">
                ❌ Voltar e conferir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={blockingAlert.isOpen} onOpenChange={(open) => setBlockingAlert(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-[425px] text-center p-8 border-4 border-destructive/20 shadow-2xl">
          <div className="flex flex-col items-center space-y-6">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center ${blockingAlert.title.includes('⚠️') ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
              <AlertTriangle className="h-12 w-12" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-2xl font-black uppercase tracking-tight">{blockingAlert.title}</h2>
              <p className="text-muted-foreground text-lg font-medium leading-tight">
                {blockingAlert.message}
              </p>
            </div>

            <Button 
              onClick={() => {
                setBlockingAlert(prev => ({ ...prev, isOpen: false }));
                setTimeout(() => scannerRef.current?.focus(), 150);
              }} 
              className="w-full h-16 text-2xl font-black bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-xl shadow-primary/20"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ItensTable = ({ itens, onAdjust, readonly }: { itens: OrdemItem[]; onAdjust?: (i: OrdemItem, d: number) => void; readonly?: boolean }) => (
  <div className="border border-border rounded-xl overflow-hidden bg-white shadow-sm">
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead className="text-center">Solicitado</TableHead>
          <TableHead className="text-center">Bipado</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {itens.map((i) => {
          const sb = itemStatusBadge(i.status);
          return (
            <TableRow key={i.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {i.product?.image_url ? <img src={i.product.image_url} alt="" className="h-9 w-9 rounded object-cover" /> : <div className="h-9 w-9 rounded bg-muted" />}
                  <div className="min-w-0">
                    <p className="text-sm truncate">{i.product?.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{i.product?.sku}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center font-medium">{i.qtd_solicitada}</TableCell>
              <TableCell className="text-center">
                {!readonly && onAdjust ? (
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onAdjust(i, -1)}>−</Button>
                    <span className="font-medium w-8">{i.qtd_separada}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onAdjust(i, +1)}>+</Button>
                  </div>
                ) : (
                  <span className="font-medium">{i.qtd_separada}</span>
                )}
              </TableCell>
              <TableCell><Badge variant="outline" className={sb.cls}>{sb.label}</Badge></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
  </div>
);
