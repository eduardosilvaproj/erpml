import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Package, Warehouse, ShoppingCart, TrendingUp, Sparkles,
  ScanLine, FileText, Users, ChevronLeft, ChevronRight, X, HelpCircle
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const tourSteps = [
  {
    icon: Package,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Cadastro de Produtos",
    description: "Cadastre seus produtos com código de barras, SKU, fotos e controle de preço. Use o leitor de código de barras ou câmera para agilizar.",
  },
  {
    icon: Warehouse,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "Controle de Estoque",
    description: "Gerencie estoque físico e FULL separadamente. Faça entradas via XML de nota fiscal, conferências com bipagem e balanços de inventário.",
  },
  {
    icon: ShoppingCart,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    title: "PDV e Vendas",
    description: "Registre vendas no ponto de venda com desconto, múltiplos meios de pagamento e baixa automática de estoque.",
  },
  {
    icon: ScanLine,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Envio FULL e Transferências",
    description: "Transfira produtos para o estoque FULL com suporte a caixa fechada. Acompanhe cada etapa: separação, envio e recebimento.",
  },
  {
    icon: FileText,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    title: "Integração Mercado Livre",
    description: "Conecte sua conta ML, sincronize estoque e preços automaticamente, gerencie pedidos e responda perguntas com IA.",
  },
  {
    icon: TrendingUp,
    color: "text-warning",
    bg: "bg-warning/10",
    title: "Relatórios e Financeiro",
    description: "Acompanhe receita, lucro, margem e ticket médio. Exporte relatórios em PDF e gerencie cobranças e assinaturas.",
  },
  {
    icon: Sparkles,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    title: "Central de IA",
    description: "Use inteligência artificial para gerar descrições, otimizar títulos, analisar concorrência, prever demanda e muito mais.",
  },
  {
    icon: Users,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    title: "Equipe e CRM",
    description: "Convide membros para sua empresa com diferentes permissões. Gerencie clientes, histórico de compras e perguntas do ML.",
  },
];

export function GuidedTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem("erp-tour-seen");
    if (!seen) {
      const timer = setTimeout(() => setOpen(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    setStep(0);
    localStorage.setItem("erp-tour-seen", "1");
  };

  const current = tourSteps[step];
  const Icon = current.icon;
  const isLast = step === tourSteps.length - 1;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => { setStep(0); setOpen(true); }}
            className="flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors active:scale-95"
          >
            <HelpCircle className="h-4.5 w-4.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Como Usar</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-md p-0 gap-0 border-border/50 bg-card overflow-hidden [&>button]:hidden">
          {/* Progress bar */}
          <div className="flex gap-1 px-5 pt-5">
            {tourSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Close */}
          <button onClick={handleClose} className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors z-10">
            <X className="h-4 w-4" />
          </button>

          {/* Content */}
          <div className="flex flex-col items-center text-center px-8 pt-8 pb-6">
            <div className={`rounded-2xl p-4 ${current.bg} mb-5`}>
              <Icon className={`h-10 w-10 ${current.color}`} strokeWidth={1.5} />
            </div>
            <p className="text-xs text-muted-foreground mb-1 font-medium">
              {step + 1} de {tourSteps.length}
            </p>
            <h2 className="text-lg font-bold text-foreground mb-2">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              {current.description}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-5 pb-5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="gap-1 text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>

            {isLast ? (
              <Button size="sm" onClick={handleClose} className="gap-1">
                Começar a usar
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)} className="gap-1">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
