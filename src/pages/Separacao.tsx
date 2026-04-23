import { useState, useRef, useEffect, useCallback } from "react";
import { 
  ScanBarcode, Package, Loader2, CheckCircle2, AlertCircle, 
  ArrowLeft, RefreshCcw, History, Search, Box, FileText, Printer, CheckSquare
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  
  const [loading, setLoading] = useState(false);
  const [orderInfo, setOrderInfo] = useState<{ id: string; number: string; description: string | null } | null>(null);
  const [items, setItems] = useState<SeparacaoItem[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [lastScan, setLastScan] = useState<{ success: boolean; message: string } | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

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
  }, []);

  const getStatusBadge = (item: SeparacaoItem) => {
    if (item.status === "completo") return <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1 text-white">✅ Completo</Badge>;
    if (item.status === "parcial") return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200 gap-1">🔄 Faltam {item.neededQty - item.scannedQty}</Badge>;
    return <Badge variant="outline" className="text-muted-foreground gap-1">⏳ Pendente</Badge>;
  };

  const isComplete = productsComplete === totalProducts && totalProducts > 0;

  const handleFinish = async () => {
    if (!orderInfo) return;
    setIsFinishing(true);
    try {
      await updateStatus.mutateAsync({ id: orderInfo.id, status: "concluida" });
      toast({ title: "Separação finalizada com sucesso!", description: "A ordem foi marcada como enviada." });
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
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" /> Histórico
          </Button>
        </div>
      </div>

      {isComplete ? (
        <Card className="border-2 border-emerald-500 bg-emerald-50/30 shadow-xl animate-in zoom-in-95 duration-500">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-inner">
                <CheckCircle2 className="h-12 w-12" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-emerald-900">✅ Separação completa!</h2>
              <p className="text-emerald-700 text-lg">
                Agora acesse o Mercado Livre para gerar a Nota Fiscal.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="lg" className="gap-2 border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-semibold shadow-sm">
                    <FileText className="h-5 w-5" /> Ver resumo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Resumo da Separação</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-center">Quantidade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.productId}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-center">{item.scannedQty} / {item.neededQty}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" size="lg" className="gap-2 border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-semibold shadow-sm" onClick={() => window.print()}>
                <Printer className="h-5 w-5" /> Imprimir lista
              </Button>
              <Button 
                size="lg" 
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg font-bold px-8"
                onClick={handleFinish}
                disabled={isFinishing}
              >
                {isFinishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckSquare className="h-5 w-5" />}
                Marcar como enviado
              </Button>
            </div>
          </CardContent>
        </Card>
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
              onClick={handleFinish}
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
