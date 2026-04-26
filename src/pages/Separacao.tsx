import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  ScanBarcode, Package, Loader2, CheckCircle2, AlertCircle, 
  ArrowLeft, RefreshCcw, History, Search, Box, FileText, Printer, CheckSquare,
  Clock, Calendar, User, Video, ExternalLink, Pause, Play, X, ChevronDown, Plus, Circle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/BarcodeScannerInput";
import { useUpdateOrdemStatus, useUpdateFullOrder } from "@/hooks/useOrdensFull";
import { useProducts } from "@/hooks/useProductData";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useBarcodeSearch } from "@/hooks/useBarcodeSearch";
import { BarcodeSearchDialogs } from "@/components/barcode/BarcodeSearchDialogs";
import { Label } from "@/components/ui/label";

import { OrderRecordingSystem, type OrderRecordingSystemHandle } from "@/components/OrderRecordingSystem";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SeparacaoItem {
  productId: string;
  name: string;
  sku: string;
  ean: string | null;
  image_url: string | null;
  neededQty: number;
  scannedQty: number;
  status: "pendente" | "parcial" | "completo";
}

const Separacao = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const scanInputRef = useRef<BarcodeScannerInputHandle>(null);
  const recorderRef = useRef<OrderRecordingSystemHandle>(null);
  const updateStatus = useUpdateOrdemStatus();
  const updateFullOrder = useUpdateFullOrder();
  const barcodeSearch = useBarcodeSearch();

  
  const { user } = useAuth();
  const [userName, setUserName] = useState<string>("Administrador"); 
  const [userFullName, setUserFullName] = useState<string>("Administrador"); 
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderInfo, setOrderInfo] = useState<{ id: string; number: string; frete_ml?: string | null; description: string | null } | null>(null);
  const [items, setItems] = useState<SeparacaoItem[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [lastScan, setLastScan] = useState<{ success: boolean; message: string } | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [recordingState, setRecordingState] = useState({ isRecording: false, duration: 0 });
  
  const [previsaoData, setPrevisaoData] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [previsaoHora, setPrevisaoHora] = useState<string>("14:00");

  // Estado para fluxo de caixa (GTIN desconhecido)
  const [boxMode, setBoxMode] = useState<"idle" | "qty" | "scan_internal">("idle");
  const [tempBoxCode, setTempBoxCode] = useState("");
  const [tempBoxQty, setTempBoxQty] = useState("12");
  const [internalScanValue, setInternalScanValue] = useState("");

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productSearch, setProductSearch] = useState("");
  const { data: searchResults } = useProducts({ search: productSearch, pageSize: 5 });
  const [blockingAlert, setBlockingAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
  });

  // Fetch user profile name
  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        
        if (data?.full_name) {
          setUserFullName(data.full_name);
          setUserName(data.full_name.split(' ')[0]);
        } else {
          const nameFromEmail = user.email?.split('@')[0] || "Administrador";
          setUserFullName(nameFromEmail);
          setUserName(nameFromEmail);
        }
      }
    };
    fetchProfile();
  }, [user]);

  const duration = useMemo(() => {
    if (!startTime || !endTime) return "00:00:00";
    const diff = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
    const seconds = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }, [startTime, endTime]);

  const totalUnitsNeeded = items.reduce((acc, curr) => acc + curr.neededQty, 0);
  const totalUnitsScanned = items.reduce((acc, curr) => acc + curr.scannedQty, 0);
  const totalProducts = items.length;

  // Load order from localStorage or Supabase
  useEffect(() => {
    const loadOrder = async () => {
      try {
        const raw = localStorage.getItem("ordem_ativa");
        if (!raw) {
          toast({ title: "Nenhuma ordem de separação ativa", variant: "destructive" });
          navigate("/movimentacao-full");
          return;
        }
        const ordem = JSON.parse(raw);
        setOrderInfo({
          id: ordem.id,
          number: ordem.numero,
          frete_ml: ordem.frete_ml,
          description: ordem.descricao
        });

        // 1. Tentar restaurar estado do Supabase
        const { data: fullOrder } = await supabase
          .from("full_orders")
          .select("*, full_order_items(*, product:products(*))")
          .eq("frete_ml", ordem.frete_ml)
          .eq("company_id", companyId)
          .maybeSingle();

        if (fullOrder?.full_order_items && fullOrder.full_order_items.length > 0) {
          console.log("Carregando itens da tabela relacional...");
          const bipagemState = Array.isArray(fullOrder.bipagem_state) ? (fullOrder.bipagem_state as any[]) : [];
          
          const mappedItems: SeparacaoItem[] = fullOrder.full_order_items.map((item: any) => {
            const product = item.product;
            const bState = bipagemState.find(b => b.productId === item.product_id);
            
            return {
              productId: item.product_id,
              name: product?.name || bState?.name || 'Produto',
              sku: product?.sku || bState?.sku || '',
              ean: product?.ean || product?.barcode || bState?.ean || bState?.barcode || '',
              image_url: product?.image_url || bState?.image_url || null,
              neededQty: item.quantity || bState?.neededQty || 0,
              scannedQty: bState?.scannedQty || 0,
              status: bState?.status || 'pendente'
            };
          });
          
          setItems(mappedItems);
          setIsPaused(fullOrder.status === 'pausado');
          if (bipagemState.length > 0) {
            toast({ title: "🔄 Bipagem restaurada com sucesso!" });
          }
        } else if (fullOrder?.bipagem_state) {
          console.log("Restaurando estado de bipagem do Supabase (legado)...");
          setItems(fullOrder.bipagem_state as unknown as SeparacaoItem[]);
          setIsPaused(fullOrder.status === 'pausado');
          toast({ title: "🔄 Bipagem restaurada com sucesso!" });
        } else {
          const mappedItems: SeparacaoItem[] = ordem.produtos.map((p: any) => ({
            productId: p.product_id,
            name: p.name,
            sku: p.sku,
            ean: p.ean || p.barcode,
            image_url: p.image_url,
            neededQty: p.qtd_solicitada,
            scannedQty: 0,
            status: "pendente"
          }));
          setItems(mappedItems);
        }

        // 2. Gravação Automática
        if (ordem.autoStartRecording) {
          setTimeout(() => {
            if (recorderRef.current && !recorderRef.current.isRecording) {
              recorderRef.current.startRecording('separacao');
              toast({ title: "🎥 Gravação iniciada automaticamente" });
              
              // Limpar flag para não reiniciar ao dar refresh
              const updatedOrdem = { ...ordem };
              delete updatedOrdem.autoStartRecording;
              localStorage.setItem("ordem_ativa", JSON.stringify(updatedOrdem));
            }
          }, 1000);
        }
      } catch (err) {
        console.error("Erro ao carregar ordem:", err);
        navigate("/movimentacao-full");
      }
    };

    loadOrder();
  }, [navigate, toast]);

  const productsComplete = items.filter(i => i.status === "completo").length;

  const processScanResult = useCallback((produto: any, qty: number, code: string) => {
    // 1. Verificar se o código já existe na ordem
    const itemIndex = items.findIndex(i => 
      i.productId === produto.id ||
      i.ean === code.trim().toUpperCase() || 
      i.sku.toUpperCase() === code.trim().toUpperCase()
    );

    if (itemIndex !== -1) {
      const item = items[itemIndex];
      if (item.scannedQty >= item.neededQty) {
        setBlockingAlert({
          isOpen: true,
          title: "Produto já completo!",
          message: `${item.name} já atingiu a quantidade necessária. Verifique o item.`
        });
        setScanValue("");
        scanInputRef.current?.flash(false);
        return;
      }

      const newScannedQty = Math.min(item.neededQty, item.scannedQty + qty);
      const newStatus = newScannedQty === item.neededQty ? "completo" : "parcial";
      
      setItems(prev => {
        const newItems = [...prev];
        newItems[itemIndex] = {
          ...item,
          scannedQty: newScannedQty,
          status: newStatus
        };
        return newItems;
      });

      const prefix = qty > 1 ? `📦 Caixa de ` : `✓ `;
      setLastScan({ success: true, message: `${prefix}${item.name} (${newScannedQty}/${item.neededQty})` });
      scanInputRef.current?.flash(true);
      setScanValue("");
      return;
    }

    // Produto não faz parte desta ordem
    setLastScan({ success: false, message: `"${produto.name}" não faz parte desta ordem.` });
    scanInputRef.current?.flash(false);
    setScanValue("");
  }, [items]);

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) return;
    
    if (!startTime) setStartTime(new Date());

    // Se estivermos esperando o produto interno da caixa
    if (boxMode === "scan_internal") {
      const internalCode = code.trim().toUpperCase();
      const itemIndex = items.findIndex(i => 
        i.ean === internalCode || 
        i.sku.toUpperCase() === internalCode
      );

      if (itemIndex !== -1) {
        const item = items[itemIndex];
        const qtyToLow = parseInt(tempBoxQty);
        const newScannedQty = Math.min(item.neededQty, item.scannedQty + qtyToLow);
        const newStatus = newScannedQty === item.neededQty ? "completo" : "parcial";
        
        setItems(prev => {
          const newItems = [...prev];
          newItems[itemIndex] = {
            ...item,
            scannedQty: newScannedQty,
            status: newStatus
          };
          return newItems;
        });

        setBoxMode("idle");
        setScanValue("");
        setInternalScanValue("");
        setLastScan({ success: true, message: `📦 Caixa de ${qtyToLow}x ${item.name} registrada!` });
        scanInputRef.current?.flash(true);
      } else {
        setLastScan({ success: false, message: `O produto "${internalCode}" não está nesta ordem.` });
        scanInputRef.current?.flash(false);
      }
      return;
    }

    await barcodeSearch.handleSearch(code, (result) => {
      processScanResult(result.produto, result.qty, code);
    });
  }, [items, startTime, barcodeSearch, boxMode, tempBoxQty, processScanResult]);
  
  // Auto-save effect
  useEffect(() => {
    const autoSave = async () => {
      if (!orderInfo || items.length === 0 || isPaused) return;
      try {
        await supabase.from('full_orders').update({
          bipagem_state: items as any,
          updated_at: new Date().toISOString()
        }).eq('frete_ml', orderInfo.frete_ml || orderInfo.number)
          .eq('company_id', companyId);
      } catch (err) {
        console.error("Auto-save error:", err);
      }
    };
    
    const timer = setTimeout(autoSave, 1000);
    return () => clearTimeout(timer);
  }, [items, orderInfo, isPaused, companyId]);


  const handlePause = async () => {
    if (!orderInfo || !user) return;
    setIsPausing(true);
    try {
      // Parar gravação se estiver ocorrendo
      if (recorderRef.current?.isRecording) {
        recorderRef.current.stopRecording();
      }

      // Salvar estado no Supabase
      await supabase.from('full_orders').update({
        bipagem_state: items as any,
        status: 'pausado',
        pausado_em: new Date().toISOString()
      }).eq('frete_ml', orderInfo.frete_ml || orderInfo.number)
        .eq('company_id', companyId);

      setIsPaused(true);
      toast({ 
        title: "⏸ Bipagem pausada", 
        description: "Estado salvo com segurança. Você pode fechar esta tela." 
      });
    } catch (err: any) {
      toast({ title: "Erro ao pausar", description: err.message, variant: "destructive" });
    } finally {
      setIsPausing(false);
    }
  };

  const handleContinue = async () => {
    setIsPaused(false);
    // Iniciar uma NOVA gravação
    if (recorderRef.current) {
      recorderRef.current.startRecording('separacao');
      toast({ title: "🎥 Nova gravação iniciada — continuando bipagem" });
    }
  };

  // handleSaveBoxGtin removido pois o fluxo agora é inline na bipagem e não cadastra no banco como solicitado.

  const generatePDF = useCallback(() => {
    if (!orderInfo) return;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("RELATÓRIO DE SEPARAÇÃO", 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Pedido: Frete #${orderInfo.frete_ml || orderInfo.number}`, 14, 30);
    doc.text(`Data: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 37);
    doc.text(`Responsável: ${userFullName}`, 14, 44);

    const tableData = items.map((item, index) => [
      index + 1,
      item.barcode || item.sku,
      item.name,
      item.neededQty,
      item.scannedQty,
      Math.max(0, item.neededQty - item.scannedQty),
      item.status === "completo" ? "✅ OK" : "❌ PENDENTE"
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['#', 'EAN/SKU', 'NOME', 'NECESSÁRIO', 'SEPARADO', 'FALTAM', 'STATUS']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [45, 45, 45] },
      styles: { fontSize: 9 }
    });

    doc.setFontSize(12);
    doc.text(`TOTAL: ${totalProducts} produtos · ${totalUnitsScanned} unidades`, 14, (doc as any).lastAutoTable.finalY + 10);
    
    doc.save(`relatorio-separacao-frete-${orderInfo.frete_ml || orderInfo.number}.pdf`);
  }, [orderInfo, items, totalProducts, totalUnitsScanned, userName]);

  useEffect(() => {
    if (items.length > 0 && items.every(i => i.status === "completo") && !endTime) {
      setEndTime(new Date());
    }
  }, [items, endTime]);

  const getStatusBadge = (item: SeparacaoItem) => {
    if (item.status === "completo") return <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1 text-white">✅ Completo</Badge>;
    if (item.status === "parcial") return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 gap-1">🔄 Faltam {item.neededQty - item.scannedQty}</Badge>;
    return <Badge variant="outline" className="text-muted-foreground gap-1">⏳ Pendente</Badge>;
  };

  const isComplete = productsComplete === totalProducts && totalProducts > 0;

  const handleSkipSeparacao = async () => {
    // DEV ONLY - REMOVER ANTES DO DEPLOY
    if (!startTime) setStartTime(new Date());

    // 1. Marcar todos os itens com quantidade completa
    const completed: SeparacaoItem[] = items.map(item => ({
      ...item,
      scannedQty: item.neededQty,
      status: 'completo'
    }));
    setItems(completed);
    
    // FIM DEV ONLY
  };

  const handleFinalizarSeparacao = async () => {
    if (!orderInfo || !user) return;
    setIsFinishing(true);
    try {
      // 1. Verificar se já foi finalizado para evitar baixa dupla
      const { data: currentOrder } = await supabase
        .from('full_orders')
        .select('separado_em, status')
        .eq('id', orderInfo.id)
        .maybeSingle();

      if (currentOrder?.separado_em || currentOrder?.status === 'aguardando_carregamento') {
        toast({ 
          title: "Ordem já finalizada", 
          description: "Esta ordem já foi processada anteriormente.",
          variant: "destructive"
        });
        navigate("/movimentacao-full");
        return;
      }

      // 2. Atualizar estoque para cada item bipado
      for (const item of items) {
        if (item.scannedQty > 0) {
          // Buscar estoque atual
          const { data: product } = await supabase
            .from('products')
            .select('stock_physical, stock_full, name')
            .eq('id', item.productId)
            .eq('company_id', companyId)
            .maybeSingle();

          if (product) {
            const currentPhysical = product.stock_physical || 0;
            const currentFull = product.stock_full || 0;
            const quantityBipada = item.scannedQty;

            if (currentPhysical < quantityBipada) {
              console.error(`Erro de estoque para ${product.name}: bipado ${quantityBipada}, disponível ${currentPhysical}`);
              toast({
                title: "Alerta de estoque",
                description: `O produto ${product.name} ficou com estoque físico insuficiente (ajustado para 0).`,
                variant: "destructive"
              });
            }

            const newPhysical = Math.max(0, currentPhysical - quantityBipada);
            const newFull = currentFull + quantityBipada;

            await supabase
              .from('products')
              .update({
                stock_physical: newPhysical,
                stock_full: newFull,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.productId)
              .eq('company_id', companyId);
          }
        }
      }

      // 3. Atualizar o status da ordem
      const previsaoCompleta = (previsaoData && previsaoHora) 
        ? new Date(`${previsaoData}T${previsaoHora}`).toISOString()
        : null;

      await updateFullOrder.mutateAsync({
        id: orderInfo.id,
        frete_ml: orderInfo.frete_ml || orderInfo.number,
        status: 'aguardando_carregamento',
        separado_em: new Date().toISOString(),
        separado_por: user.id,
        updated_at: new Date().toISOString(),
        previsao_carregamento: previsaoCompleta
      });

      toast({ 
        title: `✅ Pedido ML — Frete #${orderInfo.frete_ml || orderInfo.number} concluído`, 
        description: "Estoque atualizado e status alterado para Aguardando Carregamento." 
      });
      
      localStorage.removeItem("ordem_ativa");
      navigate("/movimentacao-full");
    } catch (err: any) {
      toast({ title: "Erro ao finalizar", description: err.message, variant: "destructive" });
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <>
      <BarcodeSearchDialogs
        notFoundOpen={barcodeSearch.notFoundOpen}
        setNotFoundOpen={barcodeSearch.setNotFoundOpen}
        boxDetectedOpen={barcodeSearch.boxDetectedOpen}
        setBoxDetectedOpen={barcodeSearch.setBoxDetectedOpen}
        codigo={barcodeSearch.lastCodigo}
        produto={barcodeSearch.lastResult?.produto}
        boxQty={barcodeSearch.lastResult?.qty}
        isFullMode={true}
        onConfirmBox={(qty) => {
          if (barcodeSearch.lastResult) {
            processScanResult(barcodeSearch.lastResult.produto, qty, barcodeSearch.lastCodigo);
          }
        }}
        onRegisterGtin={() => {
          setTempBoxCode(barcodeSearch.lastCodigo);
          setBoxMode("qty");
        }}
        onRegisterProduct={() => {
          toast({ title: "🆕 Cadastro de produto não permitido aqui", description: "Para não quebrar o fluxo, use o menu lateral depois." });
        }}
        onLinkProduct={() => {
          toast({ title: "🔗 Vínculo não permitido aqui", description: "Para não quebrar o fluxo, use o menu lateral depois." });
        }}
      />

      {/* Fluxo de Caixa Inline */}
      <Dialog open={boxMode !== "idle"} onOpenChange={(open) => !open && setBoxMode("idle")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Box className="h-5 w-5 text-blue-500" />
              Fluxo de Caixa: {tempBoxCode}
            </DialogTitle>
          </DialogHeader>

          {boxMode === "qty" && (
            <div className="py-6 space-y-4">
              <p className="text-sm font-medium">Quantos itens tem nesta caixa?</p>
              <Input
                type="number"
                value={tempBoxQty}
                onChange={(e) => setTempBoxQty(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && setBoxMode("scan_internal")}
              />
              <Button className="w-full bg-blue-600" onClick={() => setBoxMode("scan_internal")}>
                Próximo: Bipar item interno
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
                    value={internalScanValue}
                    onChange={setInternalScanValue}
                    onScan={handleScan}
                    placeholder="Bipe o código do item da caixa..."
                    autoFocus
                    scanMode
                    className="h-12"
                    inputClassName="h-12 text-lg text-center font-mono border-2 focus:border-blue-500 bg-white text-gray-900"
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setBoxMode("qty")}>
                    Voltar
                  </Button>
                  <Button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 font-bold" 
                    onClick={() => {
                      if (internalScanValue.trim()) {
                        handleScan(internalScanValue);
                        setInternalScanValue("");
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

    <div className="container mx-auto p-4 space-y-6 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/movimentacao-full")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            📦 Separação — {orderInfo?.frete_ml ? `Frete #${orderInfo.frete_ml}` : (orderInfo?.description || `Ordem #${orderInfo?.number}`)}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Button variant="default" size="sm" onClick={handleContinue} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Play className="h-4 w-4" /> Continuar Bipagem
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handlePause} disabled={isPausing} className="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50">
              {isPausing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />} Pausar
            </Button>
          )}

          <OrderRecordingSystem 
            ref={recorderRef}
            pedidoId={orderInfo?.id || ""} 
            orderNumber={orderInfo?.number}
            freteMl={orderInfo?.frete_ml}
            defaultType="separacao"
            onRecordingChange={(isRecording, duration) => setRecordingState({ isRecording, duration })}
            trigger={
              <Button variant="outline" size="sm" className={`gap-2 ${recordingState.isRecording ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}>
                <Video className="h-4 w-4" /> 
                {recordingState.isRecording ? `🎥 gravando ${Math.floor(recordingState.duration / 60)}:${(recordingState.duration % 60).toString().padStart(2, '0')}` : 'Gravar Separação'}
              </Button>
            }
          />
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Reiniciar
          </Button>
        </div>
      </div>

      {isComplete ? (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
          {/* FLUXO VISUAL DOS STATUS */}
          <div className="flex items-center justify-center py-4 px-2 max-w-3xl mx-auto">
            <div className="flex items-center w-full">
              <div className="flex flex-col items-center flex-1 relative">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 border-2 border-emerald-500 z-10">
                  <FileText className="h-5 w-5" />
                </div>
                <span className="text-[10px] mt-1 font-bold text-emerald-600 uppercase">PDF Carregado</span>
                <div className="absolute top-5 left-[60%] w-[80%] h-0.5 bg-emerald-500"></div>
              </div>
              
              <div className="flex flex-col items-center flex-1 relative">
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white border-4 border-emerald-100 shadow-lg z-10 scale-110">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <span className="text-[11px] mt-1 font-black text-emerald-700 uppercase">Separado</span>
                <div className="absolute top-5 left-[65%] w-[70%] h-0.5 bg-gray-200"></div>
              </div>
              
              <div className="flex flex-col items-center flex-1 relative">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-gray-200 z-10">
                  <Box className="h-5 w-5" />
                </div>
                <span className="text-[10px] mt-1 font-medium text-gray-400 uppercase">Carregamento</span>
                <div className="absolute top-5 left-[60%] w-[80%] h-0.5 bg-gray-200"></div>
              </div>
              
              <div className="flex flex-col items-center flex-1">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-gray-200 z-10">
                  <Package className="h-5 w-5" />
                </div>
                <span className="text-[10px] mt-1 font-medium text-gray-400 uppercase">Enviado</span>
              </div>
            </div>
          </div>

          <Card className="border-none shadow-2xl overflow-hidden bg-white">
            <div className="bg-emerald-600 h-2 w-full"></div>
            <CardContent className="p-0">
              <div className="p-8 text-center space-y-6">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-emerald-900 tracking-tight">✅ Separação Concluída!</h2>
                  <p className="text-emerald-700 text-xl font-medium">Pedido ML #{orderInfo?.frete_ml || orderInfo?.number}</p>
                </div>

                <div className="max-w-md mx-auto bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-6 font-mono text-left space-y-3 relative">
                  <div className="absolute -top-3 left-4 bg-white px-2 text-[10px] text-gray-400 font-sans uppercase tracking-widest">Resumo do Processo</div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <Package className="h-5 w-5 text-emerald-500" />
                    <span className="font-bold">{totalProducts} produtos separados</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <Box className="h-5 w-5 text-emerald-500" />
                    <span>{totalUnitsScanned} unidades totais</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <User className="h-5 w-5 text-emerald-500" />
                    <span>Responsável: <strong>{userFullName}</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <Clock className="h-5 w-5 text-emerald-500" />
                    <span>Duração: <strong>{duration}</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <Calendar className="h-5 w-5 text-emerald-500" />
                    <span>{format(endTime || new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>

                {/* CAMPO: DATA PREVISTA DE CARREGAMENTO */}
                <div className="max-w-md mx-auto bg-blue-50/50 border border-blue-100 rounded-xl p-6 text-left space-y-4">
                  <h3 className="font-bold text-blue-900 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> 📅 Previsão de carregamento:
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input 
                      type="date" 
                      value={previsaoData}
                      onChange={(e) => setPrevisaoData(e.target.value)}
                      className="bg-white border-blue-200"
                    />
                    <Input 
                      type="time" 
                      value={previsaoHora}
                      onChange={(e) => setPrevisaoHora(e.target.value)}
                      className="bg-white border-blue-200"
                    />
                  </div>
                  <p className="text-[10px] text-blue-600 italic">Opcional: Informe quando o carregamento está previsto.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto pt-4">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="gap-3 border-2 h-14 font-bold text-gray-700 hover:bg-gray-50"
                    onClick={generatePDF}
                  >
                    <Printer className="h-5 w-5" /> Imprimir Relatório PDF
                  </Button>

                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="gap-3 border-2 h-14 font-bold text-gray-700 hover:bg-gray-50"
                    onClick={() => navigate("/movimentacao-full")}
                  >
                    <ArrowLeft className="h-5 w-5" /> Voltar para Ordens
                  </Button>

                  <Button 
                    size="lg" 
                    className="gap-3 bg-emerald-600 hover:bg-emerald-700 h-14 font-black text-white shadow-lg md:col-span-2"
                    onClick={handleFinalizarSeparacao}
                    disabled={isFinishing}
                  >
                    {isFinishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Box className="h-6 w-6" />}
                    💾 Salvar e Aguardar Carregamento
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Escanear Produto</label>
                  <div className="flex gap-2">
                    <BarcodeScannerInput
                      ref={scanInputRef}
                      value={scanValue}
                      onChange={setScanValue}
                      onScan={handleScan}
                      placeholder="Bipe o código de barras..."
                      className="flex-1"
                      autoFocus
                      scanMode
                      disabled={blockingAlert.isOpen}
                      inputClassName="text-gray-900"
                    />
                    <Button onClick={() => handleScan(scanValue)} className="px-8 font-bold" disabled={blockingAlert.isOpen}>
                      Bipar
                    </Button>
                  </div>
                </div>
              </div>

              {lastScan && (
                <div className={`p-3 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
                  lastScan.success ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {lastScan.success ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                  <span className="font-medium">{lastScan.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 bg-muted/30 p-4 rounded-xl">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center text-sm gap-x-6 gap-y-2">
                    <span className="font-medium">Progresso: <span className="font-bold text-lg">{totalUnitsScanned}/{totalUnitsNeeded}</span> unidades</span>
                    <span className="text-muted-foreground hidden sm:inline">|</span>
                    <span className="font-medium"><span className="font-bold text-lg">{productsComplete}/{totalProducts}</span> produtos completos</span>
                  </div>
                  <Progress value={(totalUnitsScanned / (totalUnitsNeeded || 1)) * 100} className="h-3" />
                  
                  {import.meta.env.DEV && (
                    <button onClick={handleSkipSeparacao}
                      style={{background:'#ff6b00', color:'white', border:'2px dashed #ff9900',
                      borderRadius:'8px', padding:'8px 16px', fontSize:'12px', cursor:'pointer', margin:'8px 0', width: '100%'}}>
                      ⚡ [DEV] Pular bipagem — marcar todos como completos
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[400px]">PRODUTO</TableHead>
                  <TableHead className="text-center">NECESSÁRIO</TableHead>
                  <TableHead className="text-center">BIPADO</TableHead>
                  <TableHead className="text-center">FALTAM</TableHead>
                  <TableHead className="text-right">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.productId} className={item.status === 'completo' ? 'bg-emerald-50/20' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="h-10 w-10 rounded-md object-cover border" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-bold text-sm leading-tight">{item.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">EAN/SKU: {item.barcode || item.sku}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-lg">{item.neededQty}</TableCell>
                    <TableCell className="text-center font-bold text-lg">
                      <span className={item.scannedQty > 0 ? "text-primary" : "text-muted-foreground"}>
                        {item.scannedQty}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span 
                        className="text-lg font-bold"
                        style={{
                          color: (item.neededQty - item.scannedQty) <= 0 ? '#22c55e' : (item.neededQty - item.scannedQty) <= 10 ? '#f59e0b' : '#ef4444'
                        }}
                      >
                        {(item.neededQty - item.scannedQty) <= 0 ? '✅ 0' : (item.neededQty - item.scannedQty)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {getStatusBadge(item)}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      Nenhum produto nesta ordem.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" size="lg" onClick={() => navigate("/movimentacao-full")}>
              Cancelar
            </Button>
            <Button 
              size="lg" 
              className="px-10 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!isComplete}
              onClick={handleFinalizarSeparacao}
            >
              Concluir Separação
            </Button>
          </div>
        </>
      )}
      <Dialog open={blockingAlert.isOpen} onOpenChange={(open) => setBlockingAlert(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-[425px] text-center p-8 border-4 border-destructive/20 shadow-2xl">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center bg-amber-100 text-amber-600">
              <AlertCircle className="h-12 w-12" />
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
                setTimeout(() => scanInputRef.current?.focus(), 150);
              }} 
              className="w-full h-16 text-2xl font-black bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-xl shadow-primary/20"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
};


export default Separacao;
