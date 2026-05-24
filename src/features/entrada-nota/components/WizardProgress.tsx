import { Check } from "lucide-react";
import { type WizardStep } from "../types";

interface WizardProgressProps {
  currentStep: WizardStep;
  completedSteps: Set<number>;
  canGoToStep: (step: number) => boolean;
  goToStep: (step: WizardStep) => void;
  stepLabels: string[];
}

export const WizardProgress = ({ currentStep, completedSteps, canGoToStep, goToStep, stepLabels }: WizardProgressProps) => {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-2 scrollbar-none">
      {stepLabels.map((label, i) => {
        const stepNum = (i + 1) as WizardStep;
        const isActive = currentStep === stepNum;
        const isCompleted = completedSteps.has(stepNum);
        const isClickable = canGoToStep(stepNum);

        return (
          <div key={label} className="flex items-center flex-1">
            <button
              disabled={!isClickable}
              onClick={() => isClickable && goToStep(stepNum)}
              className={`flex items-center gap-2 ${isClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                isCompleted
                  ? "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40"
                  : isActive
                  ? "bg-primary text-primary-foreground border-2 border-primary"
                  : "bg-muted/50 text-muted-foreground border-2 border-border"
              }`}>
                {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${
                isActive ? "text-primary" : isCompleted ? "text-emerald-400" : "text-muted-foreground"
              }`}>
                {label}
              </span>
            </button>
            {i < stepLabels.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${
                completedSteps.has(stepNum) ? "bg-emerald-500/40" : "bg-border"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
};
