import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface ReturnClassificationProps {
  itemId: string;
  currentCondition?: string | null;
  onClassify: (itemId: string, condition: string, notes?: string) => void;
}

const conditions = [
  { value: "good", label: "Aprovado", icon: CheckCircle2, color: "text-emerald-500", desc: "Produto em perfeito estado" },
  { value: "damaged", label: "Avariado", icon: XCircle, color: "text-red-500", desc: "Produto com avaria física" },
  { value: "wrong_item", label: "Errado", icon: AlertTriangle, color: "text-orange-500", desc: "Produto diferente do pedido" },
  { value: "incomplete", label: "Incompleto", icon: HelpCircle, color: "text-yellow-500", desc: "Faltam itens/acessórios" },
  { value: "packaging_violated", label: "Embalagem Violada", icon: ShieldAlert, color: "text-purple-500", desc: "Embalagem violada" },
  { value: "other", label: "Outro", icon: HelpCircle, color: "text-gray-500", desc: "Outra classificação" },
];

export const ReturnClassification = ({ itemId, currentCondition, onClassify }: ReturnClassificationProps) => {
  const [selected, setSelected] = useState(currentCondition || "");
  const [notes, setNotes] = useState("");

  const handleClassify = () => {
    if (!selected) return;
    onClassify(itemId, selected, notes || undefined);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Classificação do Produto</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {conditions.map((c) => {
          const Icon = c.icon;
          const isSelected = selected === c.value;
          return (
            <button
              key={c.value}
              onClick={() => setSelected(c.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-center transition-all ${
                isSelected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <Icon className={`h-5 w-5 ${c.color}`} />
              <span className="text-xs font-medium">{c.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{c.desc}</span>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="space-y-2">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações sobre a classificação..."
            rows={2}
          />
          <Button size="sm" onClick={handleClassify} className="w-full">
            Confirmar Classificação
          </Button>
        </div>
      )}
    </div>
  );
};