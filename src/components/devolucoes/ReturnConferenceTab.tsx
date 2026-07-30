import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarcodeScannerInput, BarcodeScannerInputHandle } from "@/components/BarcodeScannerInput";
import { ReturnClassification } from "./ReturnClassification";
import { useReturnItems, useBipReturnItem, useProcessItemDecision, useUpdateReturnStatus } from "@/hooks/useDevolucoes";
import { ItemCondition, ReturnItem } from "@/services/returns";
import { CheckCircle2, ScanLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ReturnConferenceTab({ returnId }: { returnId: string }) {
  const { data: items = [] } = useReturnItems(returnId);
  const bip = useBipReturnItem();
  const decision = useProcessItemDecision();
  const updateStatus = useUpdateReturnStatus();
  const [code, setCode] = useState("");
  const [selected, setSelected] = useState<ReturnItem | null>(null);
  const [condition, setCondition] = useState<ItemCondition | undefined>();
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const scannerRef = useRef<BarcodeScannerInputHandle>(null);
  const { toast } = useToast();

  const handleScan = async (c: string) => {
    const result = await bip.mutateAsync({ returnId, code: c });
    if (result) {
      scannerRef.current?.flash(true);
      toast({ title: `Bipado: ${result.nome_produto ?? c}` });
    } else {
      scannerRef.current?.flash(false);
      toast({ title: "Item não encontrado", variant: "destructive" });
    }
  };

  const openDecision = (item: ReturnItem) => {
    setSelected(item);
    setCondition(item.condition ?? undefined);
    setQty(item.received_quantity || item.expected_quantity);
    setNotes("");
  };

  const applyDecision = async () => {
    if (!selected || !condition) return;
    await decision.mutateAsync({
      returnItemId: selected.id,
      returnId,
      condition,
      quantity: qty,
      notes,
    });
    setSelected(null);
  };

  const finalize = async () => {
    await updateStatus.mutateAsync({ returnId, status: "aguardando_decisao" });
  };

  const allProcessed = items.length > 0 && items.every(i => i.condition);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <ScanLine className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Bipar item recebido</span>
        </div>
        <BarcodeScannerInput
          ref={scannerRef}
          value={code}
          onChange={setCode}
          onScan={handleScan}
          scanMode
          autoFocus
          placeholder="Bipe o código do produto devolvido..."
        />
      </Card>

      <div className="space-y-2">
        {items.map(item => (
          <Card key={item.id} className="p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.nome_produto ?? item.sku ?? item.ean ?? "Item"}</div>
                <div className="text-xs text-muted-foreground">
                  SKU: {item.sku ?? "-"} · Esperado: {item.expected_quantity} · Recebido: {item.received_quantity}
                </div>
                {item.condition && (
                  <div className="text-xs mt-1 flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> Classificado: {item.condition}
                  </div>
                )}
              </div>
              <Button size="sm" variant={item.condition ? "outline" : "default"} onClick={() => openDecision(item)}>
                {item.condition ? "Reavaliar" : "Classificar"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {selected && (
        <Card className="p-4 space-y-4 border-primary/40">
          <div>
            <div className="font-semibold">{selected.nome_produto}</div>
            <div className="text-xs text-muted-foreground">Classifique este item</div>
          </div>
          <ReturnClassification value={condition} onChange={setCondition} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Quantidade</label>
              <Input type="number" min={0} value={qty} onChange={e => setQty(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Observação</label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={applyDecision} disabled={!condition || decision.isPending}>
              Aplicar decisão
            </Button>
          </div>
        </Card>
      )}

      {allProcessed && (
        <div className="flex justify-end">
          <Button onClick={finalize} disabled={updateStatus.isPending}>
            Finalizar conferência
          </Button>
        </div>
      )}
    </div>
  );
}
