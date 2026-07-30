import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, PackageCheck, Trash2 } from "lucide-react";
import { useQuarantine, useReleaseQuarantine } from "@/hooks/useDevolucoes";

export function QuarantinePanel() {
  const { data = [], isLoading } = useQuarantine("em_quarentena");
  const release = useReleaseQuarantine();
  const [selected, setSelected] = useState<any | null>(null);
  const [destination, setDestination] = useState<"estoque" | "descarte">("estoque");
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (!selected) return;
    await release.mutateAsync({ quarantineId: selected.id, destination, notes });
    setSelected(null);
    setNotes("");
  };

  if (isLoading) return <div className="text-sm text-muted-foreground p-6 text-center">Carregando quarentena...</div>;
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
        <p className="mt-3 text-sm text-muted-foreground">Nada em quarentena no momento.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {(data as any[]).map(q => (
          <Card key={q.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{q.products?.name ?? "Sem produto"}</span>
                  {q.condition && <Badge variant="outline">{q.condition}</Badge>}
                  <Badge variant="secondary">Qtd: {q.quantity}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  SKU: {q.products?.sku ?? "-"} · Desde {new Date(q.created_at).toLocaleDateString("pt-BR")}
                </div>
                {q.reason && <div className="text-sm mt-1 line-clamp-2">{q.reason}</div>}
              </div>
              <Button size="sm" onClick={() => { setSelected(q); setDestination("estoque"); }}>Decidir</Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Liberar item da quarentena</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">
              <div className="font-medium">{selected?.products?.name}</div>
              <div className="text-muted-foreground">Quantidade: {selected?.quantity}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={destination === "estoque" ? "default" : "outline"}
                onClick={() => setDestination("estoque")}
              >
                <PackageCheck className="h-4 w-4 mr-1" /> Estoque
              </Button>
              <Button
                variant={destination === "descarte" ? "destructive" : "outline"}
                onClick={() => setDestination("descarte")}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Descartar
              </Button>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button>
              <Button onClick={submit} disabled={release.isPending}>Confirmar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
