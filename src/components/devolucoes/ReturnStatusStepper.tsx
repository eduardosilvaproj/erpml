import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReturnStatus } from "@/services/returns";

const STEPS: { key: ReturnStatus; label: string }[] = [
  { key: "pendente", label: "Pendente" },
  { key: "em_conferencia", label: "Conferência" },
  { key: "aguardando_decisao", label: "Decisão" },
  { key: "concluida", label: "Concluída" },
];

export function ReturnStatusStepper({ status }: { status: ReturnStatus }) {
  if (status === "cancelada") {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        Devolução cancelada
      </div>
    );
  }
  const currentIdx = STEPS.findIndex(s => s.key === status);
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium shrink-0",
                done && "bg-emerald-500 text-white border-emerald-500",
                active && "bg-primary text-primary-foreground border-primary",
                !done && !active && "bg-muted text-muted-foreground border-border"
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn("text-sm whitespace-nowrap", active ? "font-semibold" : "text-muted-foreground")}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}
