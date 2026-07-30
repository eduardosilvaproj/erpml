import { CheckCircle2, AlertTriangle, XCircle, PackageMinus, PackageX, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ItemCondition } from "@/services/returns";

const OPTIONS: { value: ItemCondition; label: string; icon: any; color: string }[] = [
  { value: "aprovado", label: "Aprovado", icon: CheckCircle2, color: "text-emerald-500 border-emerald-500/50" },
  { value: "avariado", label: "Avariado", icon: AlertTriangle, color: "text-amber-500 border-amber-500/50" },
  { value: "errado", label: "Produto errado", icon: XCircle, color: "text-red-500 border-red-500/50" },
  { value: "incompleto", label: "Incompleto", icon: PackageMinus, color: "text-orange-500 border-orange-500/50" },
  { value: "embalagem_violada", label: "Embalagem violada", icon: PackageX, color: "text-rose-500 border-rose-500/50" },
  { value: "outro", label: "Outro", icon: HelpCircle, color: "text-muted-foreground border-border" },
];

export function ReturnClassification({
  value,
  onChange,
}: {
  value?: ItemCondition | null;
  onChange: (v: ItemCondition) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {OPTIONS.map(opt => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 transition-all hover:bg-muted/50",
              active ? cn("ring-2 ring-offset-2 ring-offset-background", opt.color) : "border-border"
            )}
          >
            <Icon className={cn("h-5 w-5", opt.color)} />
            <span className="text-xs font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
