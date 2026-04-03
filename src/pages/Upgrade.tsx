import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Star, Zap, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

const plans = [
  {
    slug: "basic",
    name: "Básico",
    price: "R$ 99,90",
    period: "/mês",
    description: "Essencial para pequenos negócios",
    icon: Zap,
    features: [
      { name: "Cadastro de Produtos", included: true },
      { name: "Entrada XML (NF-e)", included: true },
      { name: "Conferência de Mercadorias", included: true },
      { name: "Controle de Estoque", included: true },
      { name: "PDV (Ponto de Venda)", included: true },
      { name: "CRM Básico", included: true },
      { name: "Até 3 usuários", included: true },
      { name: "Até 500 produtos", included: true },
      { name: "Integração Mercado Livre", included: false },
      { name: "Envio FULL", included: false },
      { name: "Painel HUB", included: false },
      { name: "IA Tributária", included: false },
      { name: "Financeiro Avançado", included: false },
    ],
  },
  {
    slug: "premium",
    name: "Premium",
    price: "R$ 249,90",
    period: "/mês",
    description: "Para negócios em crescimento",
    icon: Star,
    highlight: true,
    features: [
      { name: "Tudo do Básico", included: true },
      { name: "Integração Mercado Livre", included: true },
      { name: "Envio FULL", included: true },
      { name: "Painel HUB", included: true },
      { name: "IA Tributária", included: true },
      { name: "Financeiro Avançado", included: true },
      { name: "Até 15 usuários", included: true },
      { name: "Até 5.000 produtos", included: true },
      { name: "Suporte prioritário", included: true },
      { name: "Multi-filial", included: false },
      { name: "API dedicada", included: false },
    ],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    price: "R$ 599,00",
    period: "/mês",
    description: "Para grandes operações",
    icon: Crown,
    features: [
      { name: "Tudo do Premium", included: true },
      { name: "Multi-filial", included: true },
      { name: "API dedicada", included: true },
      { name: "Usuários ilimitados", included: true },
      { name: "Produtos ilimitados", included: true },
      { name: "Suporte dedicado 24/7", included: true },
      { name: "SLA garantido", included: true },
      { name: "Treinamento personalizado", included: true },
    ],
  },
];

export default function Upgrade() {
  const navigate = useNavigate();
  const { planName } = usePlanFeatures();

  const currentSlug = planName?.toLowerCase() || "free";

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentSlug;
          const Icon = plan.icon;

          return (
            <Card
              key={plan.slug}
              className={`relative flex flex-col ${
                plan.highlight
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : ""
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Mais popular</Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
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
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.highlight ? "default" : "outline"}
                    onClick={() =>
                      window.open(
                        `https://wa.me/5500000000000?text=${encodeURIComponent(
                          `Olá! Gostaria de fazer upgrade para o plano ${plan.name}.`
                        )}`,
                        "_blank"
                      )
                    }
                  >
                    {plan.slug === "enterprise" ? "Fale conosco" : "Fazer upgrade"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
