import { useState } from "react";
import { usePlans, useCreateCompany } from "@/hooks/useCompanyData";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function Onboarding() {
  const { data: plans, isLoading } = usePlans();
  const createCompany = useCreateCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"plan" | "company">("plan");
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [companyName, setCompanyName] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !selectedPlan) return;

    try {
      await createCompany.mutateAsync({ name: companyName.trim(), plan_id: selectedPlan });
      await queryClient.invalidateQueries({ queryKey: ["my-company"] });
      toast.success("Empresa criada com sucesso!");
      navigate("/boas-vindas");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar empresa");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">Bem-vindo ao ERP System</h1>
        <p className="text-muted-foreground mt-2">
          {step === "plan" ? "Escolha o plano ideal para sua empresa" : "Informe o nome da sua empresa"}
        </p>
      </div>

      {step === "plan" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans?.map((plan) => (
              <Card
                key={plan.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-lg",
                  selectedPlan === plan.id ? "ring-2 ring-primary border-primary" : ""
                )}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <CardHeader className="text-center">
                  {plan.slug === "premium" && (
                    <Badge className="self-center mb-2 bg-primary text-primary-foreground">Mais Popular</Badge>
                  )}
                  {plan.slug === "enterprise" && (
                    <Badge variant="outline" className="self-center mb-2 border-primary text-primary">Completo</Badge>
                  )}
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">
                      {plan.price === 0 ? "Grátis" : `R$ ${plan.price.toFixed(2)}`}
                    </span>
                    {plan.price > 0 && <span className="text-sm">/mês</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">
                    Até {plan.max_users} usuário(s) • {plan.max_products >= 99999 ? "∞" : plan.max_products} produtos
                  </p>
                </CardContent>
                <CardFooter>
                  <Button
                    variant={selectedPlan === plan.id ? "default" : "outline"}
                    className="w-full"
                    onClick={(e) => { e.stopPropagation(); setSelectedPlan(plan.id); }}
                  >
                    {selectedPlan === plan.id ? "Selecionado" : "Selecionar"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button
              size="lg"
              disabled={!selectedPlan}
              onClick={() => setStep("company")}
            >
              Continuar
            </Button>
          </div>
        </>
      ) : (
        <Card className="max-w-md mx-auto">
          <form onSubmit={handleCreate}>
            <CardHeader className="text-center">
              <Building2 className="h-10 w-10 mx-auto text-primary mb-2" />
              <CardTitle>Nome da Empresa</CardTitle>
              <CardDescription>Você poderá completar os dados depois</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome</Label>
                <Input
                  id="companyName"
                  placeholder="Nome da empresa"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setStep("plan")}>Voltar</Button>
              <Button type="submit" className="flex-1" disabled={createCompany.isPending || !companyName.trim()}>
                {createCompany.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Criar Empresa
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
