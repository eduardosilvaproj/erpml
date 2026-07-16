import { useNavigate } from "react-router-dom";
import { Shield, ShieldAlert, ShieldCheck, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuarantineItems, useReleaseQuarantine, useDiscardQuarantine } from "@/hooks/useDevolucoes";

export const QuarantinePanel = () => {
  const navigate = useNavigate();
  const { data: items, isLoading } = useQuarantineItems();
  const releaseMutation = useReleaseQuarantine();
  const discardMutation = useDiscardQuarantine();

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ShieldAlert className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhum item em quarentena</p>
        <p className="text-sm mt-1">Itens divergentes de devoluções aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>{items.length} item(ns) em quarentena</span>
      </div>
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="font-medium">{item.products?.name || "Produto não encontrado"}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>SKU: {item.products?.sku || "—"}</span>
                  <Badge variant="secondary">{item.quantity} un</Badge>
                  <Badge variant="outline">{item.reason || "Sem motivo"}</Badge>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => releaseMutation.mutate(item.id)}>
                  <ShieldCheck className="h-3.5 w-3.5" /> Liberar
                </Button>
                <Button size="sm" variant="destructive" className="gap-1" onClick={() => discardMutation.mutate({ quarantineId: item.id, reason: "descartado" })}>
                  <Trash2 className="h-3.5 w-3.5" /> Descartar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};