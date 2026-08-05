import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Star, Zap, ArrowLeft, Sparkles, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useAuth } from "@/contexts/AuthContext";
import { useMyCompany } from "@/hooks/useCompanyData";
import { useAsaasPayment } from "@/hooks/useAsaasPayment";
import { AsaasCheckoutDialog } from "@/components/AsaasCheckoutDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const plans = [
  {
    slug: "basic",
    name: "Básico",
    price: "Grátis",
    period: "",
    description: "O essencial para começar a organizar seu negócio, sem custo.",
    icon: Zap,
    badge: null,
    features: [
      { name: "Dashboard completo", included: true },
      { name: "Cadastro de até 100 produtos", included: true },
      { name: "PDV básico", included: true },
      { name: "Controle de Estoque", included: true },
      { name: "Entrada XML (NF-e)", included: true },
      { name: "Conferência de Mercadorias", included: true },
      { name: "CRM básico", included: true },
      { name: "Até 2 usuários", included: true },
      { name: "Integração Mercado Livre", included: false },
      { name: "Financeiro Avançado", included: false },
      { name: "Recursos de IA", included: false },
      { name: "Suporte prioritário", included: false },
    ],
  },
  {
    slug: "premium",
    name: "Premium",
    price: "R$ 197,90",
    period: "/mês",
    description: "Gerenciamento avançado com integrações de marketplace, relatórios e suporte prioritário.",
    icon: Star,
    highlight: true,
    badge: "Mais popular",
    features: [
      { name: "Tudo do Básico", included: true },
      { name: "Até 5.000 produtos", included: true },
      { name: "Até 10 usuários", included: true },
      { name: "Integração Mercado Livre", included: true },
      { name: "Envio FULL", included: true },
      { name: "Painel HUB", included: true },
      { name: "Financeiro Avançado", included: true },
      { name: "Campanhas de Anúncios", included: true },
      { name: "Kits de Produtos", included: true },
      { name: "Relatórios completos", included: true },
      { name: "Suporte prioritário", included: true },
      { name: "Recursos de IA completos", included: false },
      { name: "Multi-filiais", included: false },
    ],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    price: "R$ 497,90",
    period: "/mês",
    description: "Todos os recursos desbloqueados, incluindo IA avançada, automações e suporte dedicado.",
    icon: Crown,
    badge: "Mais completo",
    features: [
      { name: "Tudo do Premium", included: true },
      { name: "Produtos ilimitados", included: true },
      { name: "Usuários ilimitados", included: true },
      { name: "IA Tributária & Chat IA", included: true },
      { name: "Análise de Concorrência IA", included: true },
      { name: "Previsão de Demanda IA", included: true },
      { name: "Preço Dinâmico IA", included: true },
      { name: "Análise de Mercado IA", included: true },
      { name: "Análise de Rentabilidade IA", included: true },
      { name: "Gerador de Descrições IA", included: true },
      { name: "Sugestão de Respostas IA", included: true },
      { name: "Multi-filiais", included: true },
      { name: "API dedicada", included: true },
      { name: "Suporte dedicado 24/7", included: true },
      { name: "SLA garantido", included: true },
      { name: "Consultoria personalizada", included: true },
    ],
  },
];

export default function Upgrade() {
  const navigate = useNavigate();
  const { planName } = usePlanFeatures();
  const { user } = useAuth();
  const { data: company } = useMyCompany();
  const { cancelSubscription, loading: cancelLoading } = useAsaasPayment();
  const queryClient = useQueryClient();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ slug: string; name: string; price: string } | null>(null);

  const currentSlug = planName?.toLowerCase() || "free";
  const isPaidPlan = currentSlug !== "free" && currentSlug !== "basic";

  const handleUpgrade = (plan: typeof plans[number]) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setSelectedPlan({ slug: plan.slug, name: plan.name, price: plan.price });
    setCheckoutOpen(true);
  };

  const handleCancel = async () => {
    if (!company?.id) return;
    const success = await cancelSubscription(company.id);
    if (success) {
      toast.success("Assinatura cancelada com sucesso. Seu plano foi alterado para Básico.");
      queryClient.invalidateQueries({ queryKey: ["my-company"] });
    }
  };

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Upgrade de Plano</h1>
          <p className="text-muted-foreground">
            Seu plano atual: <Badge variant="outline">{planName || "Gratuito"}</Badge>
          </p>
        </div>
      </div>

      {isPaidPlan && user && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-sm">Cancelar assinatura</p>
                <p className="text-xs text-muted-foreground">
                  Ao cancelar, seu plano será alterado para Básico (gratuito).
                </p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={cancelLoading}>
                  {cancelLoading ? "Cancelando..." : "Cancelar plano"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja cancelar sua assinatura do plano <strong>{planName}</strong>?
                    Você perderá acesso a todos os recursos exclusivos e será rebaixado ao plano Básico (gratuito).
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Manter plano</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirmar cancelamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentSlug || (plan.slug === "basic" && currentSlug === "free");
          const Icon = plan.icon;

          return (
            <Card
              key={plan.slug}
              className={`relative flex flex-col ${
                plan.highlight
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : plan.slug === "enterprise"
                  ? "border-amber-500/40 shadow-md ring-1 ring-amber-500/10"
                  : ""
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge
                    className={
                      plan.slug === "enterprise"
                        ? "bg-amber-500 text-white hover:bg-amber-600"
                        : "bg-primary text-primary-foreground"
                    }
                  >
                    {plan.slug === "enterprise" && <Sparkles className="h-3 w-3 mr-1" />}
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <div
                  className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full ${
                    plan.slug === "enterprise"
                      ? "bg-amber-500/15"
                      : "bg-primary/10"
                  }`}
                >
                  <Icon
                    className={`h-6 w-6 ${
                      plan.slug === "enterprise" ? "text-amber-500" : "text-primary"
                    }`}
                  />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2 flex-1 mb-4">
                  {plan.features.map((feature) => (
                    <li key={feature.name} className="flex items-center gap-2 text-sm">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <span className={feature.included ? "" : "text-muted-foreground/60"}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button disabled className="w-full">
                    Plano atual
                  </Button>
                ) : plan.slug === "basic" ? (
                  <Button disabled variant="outline" className="w-full">
                    Plano gratuito
                  </Button>
                ) : (
                  <Button
                    className={`w-full ${
                      plan.slug === "enterprise"
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : ""
                    }`}
                    variant={plan.highlight ? "default" : "default"}
                    onClick={() => handleUpgrade(plan)}
                  >
                    Fazer upgrade
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedPlan && (
        <AsaasCheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          planSlug={selectedPlan.slug}
          planName={selectedPlan.name}
          planPrice={selectedPlan.price}
        />
      )}
    </div>
  );
}
