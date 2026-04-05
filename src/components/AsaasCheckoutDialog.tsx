import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAsaasPayment } from "@/hooks/useAsaasPayment";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";
import { CreditCard, QrCode, FileText, Loader2, Copy, ExternalLink } from "lucide-react";

interface AsaasCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planSlug: string;
  planName: string;
  planPrice: string;
}

export function AsaasCheckoutDialog({
  open,
  onOpenChange,
  planSlug,
  planName,
  planPrice,
}: AsaasCheckoutDialogProps) {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { createCustomer, createSubscription, loading } = useAsaasPayment();

  const [step, setStep] = useState<"form" | "result">("form");
  const [name, setName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [billingType, setBillingType] = useState<"PIX" | "BOLETO" | "CREDIT_CARD">("PIX");
  const [result, setResult] = useState<{ invoiceUrl: string | null } | null>(null);

  const handleSubmit = async () => {
    if (!user || !companyId) {
      toast.error("Você precisa estar logado para contratar um plano.");
      return;
    }

    if (!name.trim() || name.trim().length < 2) {
      toast.error("Informe seu nome completo.");
      return;
    }

    const cleanDoc = cpfCnpj.replace(/\D/g, "");
    if (cleanDoc.length < 11) {
      toast.error("Informe um CPF ou CNPJ válido.");
      return;
    }

    // Step 1: Create customer
    const customerId = await createCustomer({
      name: name.trim(),
      cpfCnpj: cleanDoc,
      email: user.email,
    });

    if (!customerId) return;

    // Step 2: Create subscription
    const sub = await createSubscription({
      customerId,
      planSlug,
      billingType,
      companyId,
    });

    if (!sub) return;

    setResult(sub);
    setStep("result");
    toast.success("Assinatura criada com sucesso!");
  };

  const handleClose = () => {
    setStep("form");
    setName("");
    setCpfCnpj("");
    setBillingType("PIX");
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assinar plano {planName}</DialogTitle>
          <DialogDescription>
            Valor: <strong>{planPrice}/mês</strong>
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
              <Input
                id="cpfCnpj"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="000.000.000-00"
                maxLength={18}
              />
            </div>

            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <RadioGroup
                value={billingType}
                onValueChange={(v) => setBillingType(v as "PIX" | "BOLETO" | "CREDIT_CARD")}
                className="grid grid-cols-3 gap-2"
              >
                <Label
                  htmlFor="pix"
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                    billingType === "PIX" ? "border-primary bg-primary/5" : "border-muted"
                  }`}
                >
                  <RadioGroupItem value="PIX" id="pix" className="sr-only" />
                  <QrCode className="h-5 w-5" />
                  <span className="text-xs font-medium">PIX</span>
                </Label>
                <Label
                  htmlFor="boleto"
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                    billingType === "BOLETO" ? "border-primary bg-primary/5" : "border-muted"
                  }`}
                >
                  <RadioGroupItem value="BOLETO" id="boleto" className="sr-only" />
                  <FileText className="h-5 w-5" />
                  <span className="text-xs font-medium">Boleto</span>
                </Label>
                <Label
                  htmlFor="credit_card"
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                    billingType === "CREDIT_CARD" ? "border-primary bg-primary/5" : "border-muted"
                  }`}
                >
                  <RadioGroupItem value="CREDIT_CARD" id="credit_card" className="sr-only" />
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs font-medium">Cartão</span>
                </Label>
              </RadioGroup>
            </div>

            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...
                </>
              ) : (
                "Confirmar assinatura"
              )}
            </Button>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4 text-center">
            <div className="text-green-500 text-lg font-semibold">✅ Assinatura criada!</div>
            <p className="text-sm text-muted-foreground">
              Sua assinatura foi criada com sucesso. Realize o pagamento para ativar seu plano.
            </p>

            {result.invoiceUrl && (
              <div className="space-y-2">
                <Button
                  onClick={() => window.open(result.invoiceUrl!, "_blank")}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir link de pagamento
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(result.invoiceUrl!);
                    toast.success("Link copiado!");
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar link
                </Button>
              </div>
            )}

            <Button variant="ghost" onClick={handleClose} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
