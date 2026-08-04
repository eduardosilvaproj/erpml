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
import { ordersService } from "@/services/orders";
import { productsService } from "@/services/products";
import { useCompanyId } from "@/hooks/useCompanyId";
import { supabase } from "@/integrations/supabase/client";
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
  kitId?: string | null;
  isKit?: boolean;
  components?: { productId: string; name?: string; sku?: string; ean?: string | null; quantity: number }[];
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

        const bipagemState = Array.isArray(fullOrder?.bipagem_state) ? (fullOrder!.bipagem_state as any[]) : [];

        if (bipagemState.length > 0) {
          // bipagem_state é a fonte de verdade: inclui linhas de kit (que não
          // têm product_id no join full_order_items → products).
          console.log("Carregando itens do bipagem_state...");
          const mappedItems: SeparacaoItem[] = bipagemState.map((b: any) => ({
            productId: b.productId,
            name: b.name || 'Produto',
            sku: b.sku || '',
            ean: b.barcode || b.ean || '',
            image_url: b.image_url || null,
            neededQty: b.neededQty || 0,
            scannedQty: b.scannedQty || 0,
            status: b.status || 'pendente',
            kitId: b.kitId || null,
            isKit: !!b.isKit,
            components: b.components || undefined,
          }));
          setItems(mappedItems);
          setIsPaused(fullOrder!.status === 'pausado');
          toast({ title: "🔄 Bipagem restaurada com sucesso!" });
        } else if (fullOrder?.full_order_items && fullOrder.full_order_items.length > 0) {
          console.log("Carregando itens da tabela relacional...");
          const mappedItems: SeparacaoItem[] = fullOrder.full_order_items.map((item: any) => {
            const product = item.product;
            return {
              productId: item.product_id,
              name: product?.name || 'Produto',
              sku: product?.sku || '',
              ean: product?.ean || product?.barcode || '',
              image_url: product?.image_url || null,
              neededQty: item.quantity || 0,
              scannedQty: 0,
              status: 'pendente',
            };
          });
          setItems(mappedItems);
          setIsPaused(fullOrder.status === 'pausado');
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
    // Normaliza o código para busca (uppercase e sem espaços)
    const normalizedCode = code.trim().toUpperCase();

    // 1. Verificar se o código já existe na ordem
    const itemIndex = items.findIndex(i =>
      i.productId === produto.id ||
      (i.ean && i.ean.toUpperCase() === normalizedCode) ||
      (i.sku && i.sku.toUpperCase() === normalizedCode)
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

      const prefix = qty > 1 ? `Caixa de ` : ``;
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
        (i.ean && i.ean.toUpperCase() === internalCode) ||
        (i.sku && i.sku.toUpperCase() === internalCode)
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
        setLastScan({ success: true, message: `Caixa de ${qtyToLow}x ${item.name} registrada` });
        scanInputRef.current?.flash(true);
      } else {
        setLastScan({ success: false, message: `O produto "${internalCode}" não está nesta ordem.` });
        scanInputRef.current?.flash(false);
      }
      return;
    }

    await barcodeSearch.handleSearch(code, (result) => {
      processScanResult(result.produto, result.qty, code);
    }, (kitResult) => {
      // Kit = 1 LINHA na ordem. Bipa o código universal do kit e incrementa
      // 1 unidade da linha do kit (match por kitId / ean / sku).
      const kit = kitResult.kit;
      const codeUpper = code.trim().toUpperCase();
      const itemIndex = items.findIndex(i =>
        (i.isKit && i.kitId && i.kitId === kit.id) ||
        (i.isKit && i.ean && i.ean.toUpperCase() === codeUpper) ||
        (i.isKit && i.sku && i.sku.toUpperCase() === codeUpper) ||
        (i.productId === kit.id)
      );

      if (itemIndex === -1) {
        setLastScan({ success: false, message: `Kit "${kit.name}" não faz parte desta ordem.` });
        scanInputRef.current?.flash(false);
        setScanValue("");
        return;
      }

      const item = items[itemIndex];
      if (item.scannedQty >= item.neededQty) {
        setBlockingAlert({
          isOpen: true,
          title: "Kit já completo!",
          message: `Kit "${item.name}" já atingiu a quantidade necessária.`
        });
        setScanValue("");
        scanInputRef.current?.flash(false);
        return;
      }

      const newScannedQty = Math.min(item.neededQty, item.scannedQty + 1);
      const newStatus = newScannedQty === item.neededQty ? "completo" : "parcial";

      setItems(prev => {
        const newItems = [...prev];
        newItems[itemIndex] = { ...item, scannedQty: newScannedQty, status: newStatus };
        return newItems;
      });

      setLastScan({ success: true, message: `🎁 Kit "${kit.name}" (${newScannedQty}/${item.neededQty})` });
      scanInputRef.current?.flash(true);
      setScanValue("");
    });
  }, [items, startTime, barcodeSearch, boxMode, tempBoxQty, processScanResult]);
  
  // Auto-save effect
  useEffect(() => {
    const autoSave = async () => {
      if (!orderInfo || items.length === 0 || isPaused) return;
      try {
        await ordersService.updateOrdem(orderInfo.id, {
          bipagem_state: items as any,
          updated_at: new Date().toISOString()
        }, companyId);
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
      await ordersService.updateOrdem(orderInfo.id, {
        bipagem_state: items as any,
        status: 'pausado',
        pausado_em: new Date().toISOString()
      }, companyId);

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
      item.ean || item.sku,
      item.name,
      item.neededQty,
      item.scannedQty,
      Math.max(0, item.neededQty - item.scannedQty),
      item.status === "completo" ? "OK" : "PENDENTE"
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
    // Badges sem emoji e sem preenchimento saturado: em tabela densa o
    // peso visual atrapalha a varredura. A cor da borda já classifica.
    const base = "rounded-sm border px-1.5 py-0 text-[11px] font-medium uppercase tracking-wide";
    if (item.status === "completo") {
      return (
        <span className={base} style={{ color: "hsl(var(--success))", borderColor: "hsl(var(--success) / 0.4)", background: "hsl(var(--success) / 0.08)" }}>
          Completo
        </span>
      );
    }
    if (item.status === "parcial") {
      return (
        <span className={base} style={{ color: "hsl(var(--warning))", borderColor: "hsl(var(--warning) / 0.4)", background: "hsl(var(--warning) / 0.08)" }}>
          Parcial
        </span>
      );
    }
    return (
      <span className={base} style={{ color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}>
        Pendente
      </span>
    );
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
    if (!orderInfo || !user || !companyId) return;
    setIsFinishing(true);
    try {
      await ordersService.finalizarSeparacao(orderInfo.id, companyId, user.id);

      toast({ 
        title: "✅ Separação concluída!", 
        description: "Estoque atualizado e ordem pronta para carregamento." 
      });
      
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
        {/* .op também aqui: Portal escapa o escopo da página */}
        <DialogContent className="op sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Box className="h-4 w-4 text-primary" />
              Fluxo de caixa: <span className="code">{tempBoxCode}</span>
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
              <Button className="w-full" onClick={() => setBoxMode("scan_internal")}>
                Próximo: Bipar item interno
              </Button>
            </div>
          )}

          {boxMode === "scan_internal" && (
            <div className="py-6 space-y-6">
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <ScanBarcode className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold">Aguardando leitura…</p>
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
                    inputClassName="code h-12 text-lg text-center bg-card text-foreground border-2 focus:border-primary"
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setBoxMode("qty")}>
                    Voltar
                  </Button>
                  <Button 
                    className="flex-1 font-semibold"
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

    <div className="op min-h-screen -m-4 p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/movimentacao-full")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-base font-semibold leading-tight">
              Separação
            </h1>
            <span className="code text-xs text-muted-foreground">
              {orderInfo?.frete_ml ? `Frete ${orderInfo.frete_ml}` : (orderInfo?.description || `Ordem ${orderInfo?.number}`)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Button variant="default" size="sm" onClick={handleContinue} className="gap-2" style={{ background: "hsl(var(--success))", color: "hsl(var(--success-foreground))" }}>
              <Play className="h-4 w-4" /> Continuar Bipagem
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handlePause} disabled={isPausing} className="gap-2" style={{ color: "hsl(var(--warning))", borderColor: "hsl(var(--warning) / 0.4)" }}>
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
              <Button
                variant="outline"
                size="sm"
                className={`gap-2 ${recordingState.isRecording ? "animate-pulse" : ""}`}
                style={
                  recordingState.isRecording
                    ? { color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive) / 0.4)", background: "hsl(var(--destructive) / 0.08)" }
                    : { color: "hsl(var(--muted-foreground))" }
                }
              >
                <Video className="h-4 w-4" /> 
                {recordingState.isRecording ? `Gravando ${Math.floor(recordingState.duration / 60)}:${(recordingState.duration % 60).toString().padStart(2, '0')}` : 'Gravar separação'}
              </Button>
            }
          />
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Reiniciar
          </Button>
        </div>
      </div>

      {isComplete ? (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Esteira de status — barra fina, no lugar dos círculos grandes.
              Etapa concluída em verde, atual em azul, futura em cinza. */}
          <div className="flex gap-1">
            {[
              { label: "PDF carregado", state: "done" as const, icon: FileText },
              { label: "Separado", state: "current" as const, icon: CheckCircle2 },
              { label: "Carregamento", state: "next" as const, icon: Box },
              { label: "Enviado", state: "next" as const, icon: Package },
            ].map((step) => {
              const color =
                step.state === "done"
                  ? "hsl(var(--success))"
                  : step.state === "current"
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted-foreground))";
              return (
                <div key={step.label} className="flex-1">
                  <div
                    className="h-1 rounded-sm"
                    style={{
                      background: step.state === "next" ? "hsl(var(--border))" : color,
                    }}
                  />
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <step.icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                    <span
                      className="text-[11px] font-medium uppercase tracking-wide truncate"
                      style={{ color }}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <Card className="op-card overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4 space-y-4">
                {/* Confirmação sóbria: uma linha, sem emoji nem font-black.
                    O seller separa dezenas de ordens por dia — celebração a
                    cada uma vira ruído. */}
                <div className="flex items-center gap-2 border-l-4 pl-3 py-1"
                  style={{ borderColor: "hsl(var(--success))" }}>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">Separação concluída</span>
                    <span className="code text-xs text-muted-foreground">
                      Pedido ML {orderInfo?.frete_ml || orderInfo?.number}
                    </span>
                  </div>
                </div>

                {/* Resumo em grade densa, rótulo acima do valor */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 border-t border-border pt-3">
                  {[
                    { label: "Produtos", value: String(totalProducts) },
                    { label: "Unidades", value: String(totalUnitsScanned) },
                    { label: "Duração", value: duration },
                    { label: "Responsável", value: userFullName },
                    { label: "Concluído em", value: format(endTime || new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }) },
                  ].map((f) => (
                    <div key={f.label} className="flex flex-col min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {f.label}
                      </span>
                      <span className="text-sm font-medium truncate">{f.value}</span>
                    </div>
                  ))}
                </div>

                {/* Previsão de carregamento — campo de formulário comum,
                    não um bloco destacado com fundo azul */}
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Previsão de carregamento
                    </span>
                    <span className="text-[10px] text-muted-foreground">(opcional)</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 max-w-md">
                    <Input
                      type="date"
                      value={previsaoData}
                      onChange={(e) => setPrevisaoData(e.target.value)}
                      className="h-9"
                    />
                    <Input
                      type="time"
                      value={previsaoHora}
                      onChange={(e) => setPrevisaoHora(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border-t border-border pt-3">
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-3 h-14 font-semibold"
                    onClick={generatePDF}
                  >
                    <Printer className="h-5 w-5" /> Imprimir Relatório PDF
                  </Button>

                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="gap-3 h-14 font-semibold"
                    onClick={() => navigate("/movimentacao-full")}
                  >
                    <ArrowLeft className="h-5 w-5" /> Voltar para Ordens
                  </Button>

                  <Button
                    size="lg"
                    className="gap-3 h-14 font-semibold md:col-span-2"
                    style={{ background: "hsl(var(--success))", color: "hsl(var(--success-foreground))" }}
                    onClick={handleFinalizarSeparacao}
                    disabled={isFinishing}
                  >
                    {isFinishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Box className="h-5 w-5" />}
                    Salvar e aguardar carregamento
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <Card className="op-card">
            <CardContent className="p-3 space-y-3">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Escanear produto</label>
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
                      inputClassName="code h-12 text-lg tracking-wide bg-card text-foreground border-2 focus:border-primary"
                    />
                    <Button onClick={() => handleScan(scanValue)} className="h-12 px-8 font-semibold" disabled={blockingAlert.isOpen}>
                      Bipar
                    </Button>
                  </div>
                </div>
              </div>

              {lastScan && (
                <div
                  className="flex items-center gap-2 border-l-4 px-3 py-2 text-sm animate-in fade-in slide-in-from-top-1 duration-200"
                  style={{
                    borderColor: lastScan.success ? "hsl(var(--success))" : "hsl(var(--destructive))",
                    background: lastScan.success ? "hsl(var(--success) / 0.08)" : "hsl(var(--destructive) / 0.08)",
                    color: lastScan.success ? "hsl(var(--success))" : "hsl(var(--destructive))",
                  }}
                >
                  {lastScan.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span className="font-medium">{lastScan.message}</span>
                </div>
              )}

              <div className="border-t border-border pt-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs uppercase tracking-wide text-muted-foreground">
                    <span>
                      Unidades <span className="qty ml-1 text-base normal-case text-foreground">{totalUnitsScanned}/{totalUnitsNeeded}</span>
                    </span>
                    <span>
                      Produtos <span className="qty ml-1 text-base normal-case text-foreground">{productsComplete}/{totalProducts}</span>
                    </span>
                  </div>
                  <Progress value={(totalUnitsScanned / (totalUnitsNeeded || 1)) * 100} className="h-1.5" />
                  
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

          <Card className="op-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[400px]">Produto</TableHead>
                  <TableHead className="w-20 text-right">Necessário</TableHead>
                  <TableHead className="w-20 text-right">Bipado</TableHead>
                  <TableHead className="w-20 text-right">Faltam</TableHead>
                  <TableHead className="w-32 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const faltam = item.neededQty - item.scannedQty;
                  return (
                  <TableRow key={item.productId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="h-8 w-8 rounded-sm object-cover border border-border shrink-0" />
                        ) : (
                          <div className="h-8 w-8 rounded-sm bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium leading-snug truncate">{item.name}</span>
                          <span className="code text-[11px] text-muted-foreground">{item.ean || item.sku}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="qty text-right text-muted-foreground">{item.neededQty}</TableCell>
                    <TableCell className="qty text-right">
                      <span className={item.scannedQty > 0 ? "text-foreground" : "text-muted-foreground"}>
                        {item.scannedQty}
                      </span>
                    </TableCell>
                    <TableCell className="qty text-right">
                      <span
                        style={{
                          color: faltam <= 0
                            ? "hsl(var(--success))"
                            : faltam <= 10
                              ? "hsl(var(--warning))"
                              : "hsl(var(--destructive))",
                        }}
                      >
                        {faltam <= 0 ? "0" : faltam}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {getStatusBadge(item)}
                    </TableCell>
                  </TableRow>
                  );
                })}
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

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              {isComplete
                ? "Todos os produtos conferidos."
                : `${totalProducts - productsComplete} produto(s) ainda sem conferência completa.`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/movimentacao-full")}>
                Cancelar
              </Button>
              <Button
                className="px-6 font-semibold"
                style={isComplete ? { background: "hsl(var(--success))", color: "hsl(var(--success-foreground))" } : undefined}
                disabled={!isComplete}
                onClick={handleFinalizarSeparacao}
              >
                Concluir separação
              </Button>
            </div>
          </div>
        </>
      )}
      <Dialog open={blockingAlert.isOpen} onOpenChange={(open) => setBlockingAlert(prev => ({ ...prev, isOpen: open }))}>
        {/* .op repetido aqui: DialogContent renderiza em Portal, fora do
            container da página, então não herdaria os tokens claros. */}
        <DialogContent className="op sm:max-w-[425px] text-center p-6 border border-border">
          <div className="flex flex-col items-center space-y-6">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "hsl(var(--warning) / 0.12)", color: "hsl(var(--warning))" }}
            >
              <AlertCircle className="h-10 w-10" />
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
