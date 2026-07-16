import { Clock, User, Package, CheckCircle2, XCircle, AlertTriangle, Camera, FileText } from "lucide-react";
import { type ReturnActionData } from "@/services/returns";

interface ReturnTimelineProps {
  actions: ReturnActionData[];
}

const actionConfig: Record<string, { icon: any; color: string; label: string }> = {
  created: { icon: Package, color: "text-blue-500", label: "Criada" },
  status_recebido: { icon: Package, color: "text-blue-500", label: "Recebida" },
  status_em_conferencia: { icon: Clock, color: "text-purple-500", label: "Em Conferência" },
  status_aguardando_decisao: { icon: AlertTriangle, color: "text-orange-500", label: "Aguardando Decisão" },
  status_aprovada: { icon: CheckCircle2, color: "text-emerald-500", label: "Aprovada" },
  status_recusada: { icon: XCircle, color: "text-red-500", label: "Recusada" },
  status_concluida: { icon: CheckCircle2, color: "text-green-500", label: "Concluída" },
  status_cancelada: { icon: XCircle, color: "text-gray-500", label: "Cancelada" },
  item_classified: { icon: CheckCircle2, color: "text-emerald-500", label: "Item Classificado" },
  evidence_added: { icon: Camera, color: "text-purple-500", label: "Evidência Adicionada" },
};

export const ReturnTimeline = ({ actions }: ReturnTimelineProps) => {
  if (!actions || actions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma ação registrada</p>
      </div>
    );
  }

  return (
    <div className="relative ml-4 space-y-4">
      <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />
      {actions.map((action, idx) => {
        const cfg = actionConfig[action.action] || { icon: FileText, color: "text-gray-500", label: action.action };
        const Icon = cfg.icon;

        return (
          <div key={action.id} className="relative flex gap-3">
            <div className={`relative z-10 h-4 w-4 rounded-full border-2 border-background flex items-center justify-center ${cfg.color}`}>
              <Icon className="h-3 w-3" />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{cfg.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(action.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              {action.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
              )}
              {action.user_name && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <User className="h-3 w-3" /> {action.user_name}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};