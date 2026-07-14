import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ResetCompanyDataProps {
  companyId: string;
}

export function ResetCompanyData({ companyId }: ResetCompanyDataProps) {
  const [step, setStep] = useState(0); // 0: initial, 1: warning, 2: type confirmation, 3: success
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();

  const handleReset = async () => {
    if (typedConfirmation !== "ZERAR TUDO") return;

    setIsResetting(true);
    try {
      const { error } = await supabase.rpc("reset_company_data", {
        p_company_id: companyId,
      });

      if (error) throw error;

      setStep(3);
      toast.success("Dados apagados com sucesso.");
    } catch (error: any) {
      console.error("Error resetting company data:", error);
      toast.error(error.message || "Erro ao zerar dados");
      setStep(0);
    } finally {
      setIsResetting(false);
    }
  };

  const closeModal = () => {
    if (step !== 3) {
      setStep(0);
      setTypedConfirmation("");
    }
  };

  const handleFinalSuccess = () => {
    navigate("/");
  };

  return (
    <div className="mt-12 pt-8 border-t border-destructive/10">
      <div className="flex flex-col items-center">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive/50 hover:text-destructive hover:bg-destructive/5 text-xs font-normal"
          onClick={() => setStep(1)}
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          ⚠️ Zerar todos os dados
        </Button>
      </div>

      {/* Step 2: Warning Modal */}
      <Dialog open={step === 1} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-[425px] border-destructive/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              ⚠️ Tem certeza absoluta?
            </DialogTitle>
            <DialogDescription className="pt-4 text-foreground">
              Esta ação irá apagar <strong>PERMANENTEMENTE</strong>:
              <ul className="mt-4 space-y-2 list-disc list-inside text-sm text-muted-foreground">
                <li>Todos os produtos e estoque</li>
                <li>Todos os clientes e pedidos</li>
                <li>Todas as conferências e histórico</li>
                <li>Todas as campanhas e kits</li>
                <li>Toda a equipe (exceto sua conta admin)</li>
                <li>Configurações operacionais e logs</li>
              </ul>
              <p className="mt-6 font-bold text-destructive">
                Esta ação NÃO pode ser desfeita.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setStep(0)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => setStep(2)}
            >
              Sim, quero apagar tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 3: Typed Confirmation */}
      <Dialog open={step === 2} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmação de Segurança</DialogTitle>
            <DialogDescription>
              Para confirmar, digite: <span className="font-bold text-foreground">ZERAR TUDO</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Input
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value.toUpperCase())}
              placeholder="Digite ZERAR TUDO"
              className="text-center font-bold tracking-widest"
              autoFocus
              disabled={isResetting}
            />
            {isResetting && (
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                Processando exclusão em massa. Por favor, aguarde...
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setStep(0)} disabled={isResetting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={typedConfirmation !== "ZERAR TUDO" || isResetting}
              className="gap-2"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Apagando dados...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Apagar tudo permanentemente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 4: Success Screen */}
      <Dialog open={step === 3} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[425px] text-center py-10">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">✅ Dados apagados.</h2>
              <p className="text-muted-foreground">
                Seu sistema está zerado.
              </p>
            </div>

            <Button className="mt-4 w-full" onClick={handleFinalSuccess}>
              Ir para o Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
