import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PackageOpen, ChevronRight } from "lucide-react";
import { useReturnsList } from "@/hooks/useDevolucoes";
import { ReturnStatus, ReturnSource } from "@/services/returns";

const SOURCE_LABEL: Record<ReturnSource, string> = {
  mercado_livre: "Mercado Livre",
  loja: "Loja",
  manual: "Manual",
  pdv: "PDV",
};

const STATUS_STYLE: Record<ReturnStatus, string> = {
  pendente: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  em_conferencia: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  aguardando_decisao: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  concluida: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  cancelada: "bg-destructive/10 text-destructive border-destructive/30",
};

export function ReturnsListTab({ status }: { status?: ReturnStatus }) {
  const { data = [], isLoading } = useReturnsList(status);
  const navigate = useNavigate();

  if (isLoading) return <div className="text-sm text-muted-foreground p-8 text-center">Carregando...</div>;
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <PackageOpen className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
        <p className="mt-3 text-sm text-muted-foreground">Nenhuma devolução nesta categoria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map(r => (
        <Card
          key={r.id}
          className="p-4 cursor-pointer hover:bg-muted/40 transition-colors"
          onClick={() => navigate(`/devolucoes/${r.id}`)}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{r.numero}</span>
                <Badge variant="outline" className={STATUS_STYLE[r.status]}>{r.status.replace("_", " ")}</Badge>
                <Badge variant="secondary">{SOURCE_LABEL[r.source]}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {r.customer_name ?? "Sem cliente"} · {r.order_reference ?? "sem referência"} ·{" "}
                {new Date(r.created_at).toLocaleDateString("pt-BR")}
              </div>
              {r.motivo && <div className="text-sm mt-1 line-clamp-1">{r.motivo}</div>}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </Card>
      ))}
    </div>
  );
}
