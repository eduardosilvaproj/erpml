import { CheckCircle2, Clock, Package, AlertTriangle, XCircle } from "lucide-react";

interface ReturnStatusStepperProps {
  status: string;
}

const steps = [
  { key: "pendente_recebimento", label: "Pendente", icon: Clock, color: "text-yellow-500" },
  { key: "recebido", label: "Recebido", icon: Package, color: "text-blue-500" },
  { key: "em_conferencia", label: "Conferência", icon: AlertTriangle, color: "text-purple-500" },
  { key: "aguardando_decisao", label: "Decisão", icon: CheckCircle2, color: "text-orange-500" },
  { key: "concluida", label: "Concluída", icon: CheckCircle2, color: "text-emerald-500" },
];

const statusOrder = ["pendente_recebimento", "recebido", "em_conferencia", "aguardando_decisao", "aprovada", "recusada", "concluida", "cancelada"];

export const ReturnStatusStepper = ({ status }: ReturnStatusStepperProps) => {
  const currentIdx = statusOrder.indexOf(status);

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isActive = currentIdx >= idx;
        const isCurrent = status === step.key;

        return (
          <div key={step.key} className="flex-1 flex items-center">
            <div className={`flex flex-col items-center gap-1 ${isActive ? step.color : "text-muted-foreground/40"}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                isCurrent ? "border-current bg-current/10" : isActive ? "border-current" : "border-muted-foreground/20"
              }`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium whitespace-nowrap">{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${isActive ? "bg-current/30" : "bg-muted-foreground/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};