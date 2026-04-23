import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  ScanBarcode, Package, Loader2, CheckCircle2, AlertCircle, 
  ArrowLeft, RefreshCcw, History, Search, Box, FileText, Printer, CheckSquare,
  Clock, Calendar, User, Video, ExternalLink
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
import { useUpdateOrdemStatus } from "@/hooks/useOrdensFull";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { OrderRecordingSystem } from "@/components/OrderRecordingSystem";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SeparacaoItem {
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
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
  const updateStatus = useUpdateOrdemStatus();
  
  const { user } = useAuth();
  const [userName, setUserName] = useState<string>("Anderson"); // Default/Placeholder as in request
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderInfo, setOrderInfo] = useState<{ id: string; number: string; frete_ml?: string | null; description: string | null } | null>(null);
  const [items, setItems] = useState<SeparacaoItem[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [lastScan, setLastScan] = useState<{ success: boolean; message: string } | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isMarkingAsShipped, setIsMarkingAsShipped] = useState(false);

  // Fetch user profile name
  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (data?.full_name) {
          setUserName(data.full_name.split(' ')[0]); // Get first name
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

  // Load order from localStorage
  useEffect(() => {
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
        description: ordem.descricao
      });
      
      const mappedItems: SeparacaoItem[] = ordem.produtos.map((p: any) => ({
        productId: p.product_id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        image_url: p.image_url,
        neededQty: p.qtd_solicitada,
        scannedQty: 0,
        status: "pendente"
      }));
      setItems(mappedItems);
    } catch (err) {
      console.error("Erro ao carregar ordem:", err);
      navigate("/movimentacao-full");
    }
  }, [navigate, toast]);

  const totalUnitsNeeded = items.reduce((acc, curr) => acc + curr.neededQty, 0);
  const totalUnitsScanned = items.reduce((acc, curr) => acc + curr.scannedQty, 0);
  const totalProducts = items.length;
  const productsComplete = items.filter(i => i.status === "completo").length;

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) return;
    const trimmed = code.trim().toUpperCase();
    
    if (!startTime) setStartTime(new Date());

    setItems(prev => {
      const itemIndex = prev.findIndex(i => 
        i.barcode === trimmed || 
        i.sku.toUpperCase() === trimmed
      );

      if (itemIndex === -1) {
        setLastScan({ success: false, message: `Produto "${trimmed}" não encontrado nesta ordem.` });
        scanInputRef.current?.flash(false);
        return prev;
      }

      const item = prev[itemIndex];
      if (item.scannedQty >= item.neededQty) {
        setLastScan({ success: false, message: `"${item.name}" já está completo.` });
        scanInputRef.current?.flash(false);
        return prev;
      }

      const newScannedQty = item.scannedQty + 1;
      const newStatus = newScannedQty === item.neededQty ? "completo" : "parcial";
      
      const newItems = [...prev];
      newItems[itemIndex] = {
        ...item,
        scannedQty: newScannedQty,
        status: newStatus
      };

      setLastScan({ success: true, message: `✓ ${item.name} (${newScannedQty}/${item.neededQty})` });
      scanInputRef.current?.flash(true);
      
      return newItems;
    });

    setScanValue("");
  }, [startTime]);

  const generatePDF = useCallback(() => {
    if (!orderInfo) return;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("RELATÓRIO DE SEPARAÇÃO", 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Pedido: ${orderInfo.number}`, 14, 30);
    doc.text(`Data: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 37);
    doc.text(`Responsável: ${userName}`, 14, 44);

    const tableData = items.map((item, index) => [
      index + 1,
      item.barcode || item.sku,
      item.name,
      item.neededQty,
      item.scannedQty,
      item.status === "completo" ? "✅ OK" : "❌ PENDENTE"
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['#', 'EAN/SKU', 'NOME', 'NECESSÁRIO', 'SEPARADO', 'STATUS']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [45, 45, 45] },
      styles: { fontSize: 9 }
    });

    doc.setFontSize(12);
    doc.text(`TOTAL: ${totalProducts} produtos · ${totalUnitsScanned} unidades`, 14, (doc as any).lastAutoTable.finalY + 10);
    
    doc.save(`relatorio-separacao-${orderInfo.number}.pdf`);
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
    if (!orderInfo) return;
    setIsFinishing(true);
    try {
      await updateStatus.mutateAsync({ id: orderInfo.id, status: "concluida" });
      toast({ title: "✅ Separação concluída — pronto para carregamento", description: "A ordem foi marcada como enviada." });
      localStorage.removeItem("ordem_ativa");
      navigate("/movimentacao-full");
    } catch (err: any) {
      toast({ title: "Erro ao finalizar", description: err.message, variant: "destructive" });
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/movimentacao-full")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            📦 Separação — {orderInfo?.description || `Ordem #${orderInfo?.number}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Reiniciar
          </Button>
          {orderInfo && (
            <OrderRecordingSystem 
              pedidoId={orderInfo.id} 
              orderNumber={orderInfo.number} 
            />
          )}
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
                  <p className="text-emerald-700 text-xl font-medium">Pedido ML #{orderInfo?.number}</p>
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
                    <span>Responsável: <strong>{userName}</strong></span>
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
                
                <div className="text-left max-w-md mx-auto space-y-4 py-4">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                    PRÓXIMOS PASSOS:
                  </h3>
                  <ul className="space-y-3">
                    <li className="flex gap-3 items-start">
                      <span className="flex-none w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">1</span>
                      <p className="text-sm text-gray-600">Acesse o <strong>Mercado Livre</strong> para gerar a Nota Fiscal</p>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="flex-none w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">2</span>
                      <p className="text-sm text-gray-600">Aguarde o <strong>caminhão</strong> para carregamento</p>
                    </li>
                    <li className="flex gap-3 items-start">
                      <span className="flex-none w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">3</span>
                      <p className="text-sm text-gray-600">Grave o carregamento quando o caminhão chegar</p>
                    </li>
                  </ul>
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
                  
                  {orderInfo && (
                    <OrderRecordingSystem 
                      pedidoId={orderInfo.id} 
                      orderNumber={orderInfo.number} 
                      trigger={
                        <Button 
                          variant="outline" 
                          size="lg" 
                          className="gap-3 border-2 h-14 font-bold text-gray-700 hover:bg-gray-50"
                        >
                          <Video className="h-5 w-5 text-red-500" /> Gravar Carregamento
                        </Button>
                      }
                    />
                  )}

                  <Button 
                    size="lg" 
                    className="gap-3 bg-emerald-600 hover:bg-emerald-700 h-14 font-black text-white shadow-lg md:col-span-2"
                    onClick={handleFinalizarSeparacao}
                    disabled={isFinishing}
                  >
                    {isFinishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckSquare className="h-6 w-6" />}
                    MARCAR COMO ENVIADO
                  </Button>

                  <Button 
                    variant="ghost" 
                    size="lg" 
                    className="gap-2 text-gray-500 md:col-span-2"
                    onClick={() => navigate("/movimentacao-full")}
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar para Ordens
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
                    />
                    <Button onClick={() => handleScan(scanValue)} className="px-8 font-bold">
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
                  {/* DEV ONLY - REMOVER ANTES DO DEPLOY */}
                  {process.env.NODE_ENV === 'development' && (
                    <button
                      onClick={handleSkipSeparacao}
                      style={{
                        background: '#ff6b00',
                        color: 'white',
                        border: '2px dashed #ff9900',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        margin: '8px 0',
                        width: '100%'
                      }}
                    >
                      ⚡ [DEV] Pular bipagem — marcar todos como completos
                    </button>
                  )}
                  {/* FIM DEV ONLY */}
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
                          <span className="text-xs text-muted-foreground font-mono">SKU: {item.sku}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold text-lg">{item.neededQty}</TableCell>
                    <TableCell className="text-center font-bold text-lg">
                      <span className={item.scannedQty > 0 ? "text-primary" : "text-muted-foreground"}>
                        {item.scannedQty}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {getStatusBadge(item)}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
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
    </div>
  );
};

export default Separacao;
