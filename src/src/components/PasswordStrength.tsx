import { useMemo } from "react";
import { Check, X, ShieldCheck, ShieldAlert, Info } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
}

interface Requirement {
  label: string;
  met: boolean;
}

function getRequirements(password: string): Requirement[] {
  return [
    { label: "Mínimo de 6 caracteres", met: password.length >= 6 },
    { label: "Pelo menos 8 caracteres (recomendado)", met: password.length >= 8 },
    { label: "Letra maiúscula (A-Z)", met: /[A-Z]/.test(password) },
    { label: "Número (0-9)", met: /[0-9]/.test(password) },
    { label: "Caractere especial (!@#$...)", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

function getStrength(requirements: Requirement[]): { score: number; label: string; color: string; bgBar: string; icon: typeof ShieldCheck } {
  const score = requirements.filter((r) => r.met).length;

  if (score <= 1) return { score: 1, label: "Muito fraca", color: "text-destructive", bgBar: "bg-destructive", icon: ShieldAlert };
  if (score <= 2) return { score: 2, label: "Fraca", color: "text-orange-500", bgBar: "bg-orange-500", icon: ShieldAlert };
  if (score <= 3) return { score: 3, label: "Razoável", color: "text-yellow-600 dark:text-yellow-500", bgBar: "bg-yellow-500", icon: Info };
  if (score <= 4) return { score: 4, label: "Forte", color: "text-emerald-600 dark:text-emerald-400", bgBar: "bg-emerald-400", icon: ShieldCheck };
  return { score: 5, label: "Muito forte", color: "text-emerald-600 dark:text-emerald-400", bgBar: "bg-emerald-600", icon: ShieldCheck };
}

function getSuggestions(requirements: Requirement[]): string[] {
  const suggestions: string[] = [];
  if (!requirements[2].met) suggestions.push("Adicione uma letra maiúscula");
  if (!requirements[3].met) suggestions.push("Inclua pelo menos um número");
  if (!requirements[4].met) suggestions.push("Use um caractere especial como !@#$%");
  if (!requirements[1].met && requirements[0].met) suggestions.push("Tente usar 8 ou mais caracteres");
  return suggestions;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const requirements = useMemo(() => getRequirements(password), [password]);
  const { score, label, color, bgBar, icon: Icon } = useMemo(() => getStrength(requirements), [requirements]);
  const suggestions = useMemo(() => getSuggestions(requirements), [requirements]);

  if (!password) return null;

  return (
    <div className="space-y-3 mt-3 animate-in fade-in-0 slide-in-from-top-2 duration-300" role="status" aria-live="polite">
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex gap-1 h-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-all duration-300 ${
                i <= score ? bgBar : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className={`flex items-center gap-1.5 ${color}`}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">Força: {label}</span>
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground mb-1">Requisitos da senha:</p>
        {requirements.map((req) => (
          <div
            key={req.label}
            className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
              req.met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            }`}
          >
            {req.met ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 opacity-50" />
            )}
            <span className={req.met ? "line-through opacity-70" : ""}>{req.label}</span>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      {score <= 3 && suggestions.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/50 p-2.5 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">💡 Dicas para melhorar:</p>
          {suggestions.map((s) => (
            <p key={s} className="text-xs text-muted-foreground">• {s}</p>
          ))}
        </div>
      )}
    </div>
  );
}
