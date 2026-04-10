import { useMemo } from "react";

interface PasswordStrengthProps {
  password: string;
}

function getStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: "Fraca", color: "bg-destructive" };
  if (score <= 2) return { score: 2, label: "Razoável", color: "bg-orange-500" };
  if (score <= 3) return { score: 3, label: "Média", color: "bg-yellow-500" };
  if (score <= 4) return { score: 4, label: "Forte", color: "bg-emerald-400" };
  return { score: 5, label: "Muito forte", color: "bg-emerald-600" };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { score, label, color } = useMemo(() => getStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1 h-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors duration-300 ${
              i <= score ? color : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${
        score <= 1 ? "text-destructive" :
        score <= 2 ? "text-orange-500" :
        score <= 3 ? "text-yellow-600" :
        "text-emerald-600"
      }`}>
        Força: {label}
        {score <= 2 && (
          <span className="text-muted-foreground font-normal ml-1">
            — use letras maiúsculas, números e símbolos
          </span>
        )}
      </p>
    </div>
  );
}
