import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useReturn, useUpdateReturnStatus, useClassifyItem, useAddReturnAction } from "@/hooks/useDevolucoes";
import { ReturnStatusStepper } from "./ReturnStatusStepper";
import { ReturnClassification } from "./ReturnClassification";
import { ReturnTimeline } from "./ReturnTimeline";
import { ReturnEvidence } from "./ReturnEvidence";
import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/BarcodeScannerInput";
import { useBarcodeSearch } from "@/hooks/useBarcodeSearch";
import { useCompanyId } from "@/hooks/useCompanyId";

interface ReturnConferenceTabProps {
  returnId: string;
}

export const ReturnConferenceTab = ({ returnId }: ReturnConferenceTabProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const { data: returnData, isLoading } = useReturn(returnId);
  const updateStatus = useUpdateReturnStatus();
  const classifyItem = useClassifyItem();
  const addAction = useAddReturnAction();
  const barcodeSearch = useBarcodeSearch();
  const scannerRef = useRef<BarcodeScannerInputHandle>(null);
  const [scannedItems, setScannedItems] = useState<Record<string, number>>({});

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!returnData) {
    return <div className="text-center py-12 text-muted-foreground">Devolução não encontrada.</div>;
  }

  const handleScan = async (code: string) => {
    const result = await barcodeSearch.handleSearch(code);
    if (!result?.produto) {
      toast({ title: "Produto não encontrado", variant: "destructive" });
      return;
    }
    const productId = result.produto.id;
    setScannedItems((prev) => ({ ...prev, [productId]: (prev[productId] || 0) + result.qty }));
    toast({ title: "Produto escaneado!", description: `${result.produto.name}: +${result.qty}` });
  };

  const handleReceive = async () => {
    await updateStatus.mutateAsync({ returnId, status: "recebido" });
    await addAction.mutateAsync({ returnId, action: "status_recebido", description: "Mercadoria recebida fisicamente" });
    toast({ title: "Devolução recebida!" });
  };

  const handleStartConference = async () => {
    await updateStatus.mutateAsync({ returnId, status: "em_conferencia" });
    toast({ title: "Conferência iniciada!" });
  };

  const handleClassify = async (itemId: string, condition: string, notes?: string) => {
    await classifyItem.mutateAsync({ itemId, condition, notes });
    await addAction.mutateAsync({
      returnId, action: "item_classified",
      description: `Item classificado como: ${condition}`,
      metadata: { item_id: itemId, condition, notes },
    });
    toast({ title: "Item classificado!" });
  };

  const handleApprove = async () => {
    await updateStatus.mutateAsync({ returnId, status: "aprovada" });
    await addAction.mutateAsync({ returnId, action: "status_aprovada", description: "Devolução aprovada — estoque será atualizado" });
    toast({ title: "Devolução aprovada!", description: "Estoque será atualizado." });
  };

  const handleReject = async () => {
    await updateStatus.mutateAsync({ returnId, status: "recusada" });
    await addAction.mutateAsync({ returnId, action: "status_recusada", description: "Devolução recusada" });
    toast({ title: "Devolução recusada" });
  };

  const items = returnData.return_items || [];
  const totalScanned = Object.values(scannedItems).reduce((s, v) => s + v, 0);
  const totalExpected = items.reduce((s, i) => s + i.expected_quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/devolucoes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg font-bold">
            {returnData.ml_order_id ? `Pedido ML #${returnData.ml_order_id}` : `Devolução #${returnId.slice(0, 8)}`}
          </h2>
          <p className="text-sm text-muted-foreground">{returnData.motivo || "Sem motivo registrado"}</p>
        </div>
      </div>

      <ReturnStatusStepper status={returnData.status} />

      {/* Actions by status */}
      <div className="flex gap-2 flex-wrap">
        {returnData.status === "pendente_recebimento" && (
          <Button onClick={handleReceive}><Package className="h-4 w-4 mr-2" /> Receber Mercadoria</Button>
        )}
        {returnData.status === "recebido" && (
          <Button onClick={handleStartConference}><Camera className="h-4 w-4 mr-2" /> Iniciar Conferência</Button>
        )}
        {returnData.status === "aguardando_decisao" && (
          <>
            <Button variant="default" className="bg-emerald-600" onClick={handleApprove}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              <XCircle className="h-4 w-4 mr-2" /> Recusar
            </Button>
          </>
        )}
      </div>

      {/* Scanner (only during conference) */}
      {returnData.status === "em_conferencia" && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Escanear Produtos</CardTitle></CardHeader>
          <CardContent>
            <BarcodeScannerInput ref={scannerRef} onScan={handleScan} placeholder="Bipe o código de barras..." scanMode />
            <div className="mt-2 text-sm text-muted-foreground">
              Escaneados: {totalScanned} / {totalExpected} unidades
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Itens ({items.length})</h3>
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{item.products?.name || item.nome_produto || "Produto"}</p>
                  <p className="text-xs text-muted-foreground">SKU: {item.products?.sku || item.sku || "—"}</p>
                </div>
                <Badge variant="secondary">{item.expected_quantity} un</Badge>
              </div>
              {item.condition && (
                <Badge variant="outline">{item.condition}</Badge>
              )}
              {returnData.status === "em_conferencia" && !item.condition && (
                <ReturnClassification itemId={item.id} onClassify={handleClassify} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Evidence */}
      <ReturnEvidence returnId={returnId} />

      {/* Timeline */}
      <div>
        <h3 className="text-sm font-medium mb-3">Histórico</h3>
        <ReturnTimeline actions={returnData.return_actions || []} />
      </div>
    </div>
  );
};