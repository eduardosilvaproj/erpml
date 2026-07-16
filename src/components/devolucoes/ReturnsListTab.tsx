import { useNavigate } from "react-router-dom";
import { Undo2, Eye, Loader2, Package, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type ReturnData } from "@/services/returns";

interface ReturnsListTabProps {
  returns?: ReturnData[];
  isLoading: boolean;
  status: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente_recebimento: { label: "Pendente Recebimento", color: "bg-yellow-500/15 text-yellow-600" },
  recebido: { label: "Recebido", color: "bg-blue-500/15 text-blue-600" },
  em_conferencia: { label: "Em Conferência", color: "bg-purple-500/15 text-purple-600" },
  aguardando_decisao: { label: "Aguardando Decisão", color: "bg-orange-500/15 text-orange-600" },
  aprovada: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-600" },
  recusada: { label: "Recusada", color: "bg-red-500/15 text-red-600" },
  concluida: { label: "Concluída", color: "bg-green-500/15 text-green-600" },
  cancelada: { label: "Cancelada", color: "bg-gray-500/15 text-gray-600" },
};

export const ReturnsListTab = ({ returns, isLoading, status }: ReturnsListTabProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!returns || returns.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Undo2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhuma devolução encontrada</p>
        <p className="text-sm mt-1">Crie uma nova devolução ou aguarde a sincronização automática.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {returns.map((ret) => {
        const cfg = statusConfig[ret.status] || { label: ret.status, color: "bg-gray-500/15 text-gray-600" };
        const itemCount = ret.return_items?.length || 0;
        const totalQty = ret.return_items?.reduce((s, i) => s + i.expected_quantity, 0) || 0;

        return (
          <Card key={ret.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/devolucoes/${ret.id}`)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {ret.ml_order_id ? `Pedido ML #${ret.ml_order_id}` : `Devolução #${ret.id.slice(0, 8)}`}
                    </span>
                    <Badge variant="secondary" className={cfg.color}>{cfg.label}</Badge>
                    <Badge variant="outline" className="text-xs">{ret.source === "manual" ? "Manual" : "ML"}</Badge>
                  </div>
                  {ret.motivo && (
                    <p className="text-sm text-muted-foreground">{ret.motivo}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      {itemCount} item(ns) · {totalQty} un
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(ret.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};