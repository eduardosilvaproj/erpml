import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Step = "idle" | "warn" | "confirm" | "password" | "running" | "success";

export default function SystemResetCard() {
  const [step, setStep] = useState<Step>("idle");
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ companies: number; users: number } | null>(null);

  const reset = () => {
    setStep("idle");
    setConfirmText("");
    setPassword("");
    setProgress("");
    setResult(null);
  };

  const execute = async () => {
    setStep("running");
    setProgress("Validando credenciais...");
    try {
      const { data, error } = await supabase.functions.invoke("system-reset", {
        body: { password, confirmation: confirmText },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ companies: data.companies || 0, users: data.users || 0 });
      setStep("success");
    } catch (e: any) {
      toast.error(e.message || "Falha ao executar reset");
      setStep("password");
    }
  };

  return (
    <>
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
            <div>
              <CardTitle className="text-destructive">Reset Geral do Sistema</CardTitle>
              <CardDescription className="mt-1">
                Apaga todos os dados operacionais de todas as empresas mantendo apenas os cadastros de contas e usuários.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setStep("warn")}>
            <Trash2 className="h-4 w-4 mr-2" /> Executar Reset Geral
          </Button>
        </CardContent>
      </Card>

      {/* STEP 1: Warn */}
      <Dialog open={step === "warn"} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="border-destructive/50 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Atenção: ação irreversível
            </DialogTitle>
            <DialogDescription>Leia com atenção antes de prosseguir.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="font-semibold text-destructive mb-2">Será PERMANENTEMENTE apagado:</p>
              <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                <li>Produtos e categorias</li>
                <li>Estoque (físico e FULL)</li>
                <li>Entradas de nota (NF/XML)</li>
                <li>Vendas e pedidos</li>
                <li>Clientes e fornecedores</li>
                <li>Kits e composições</li>
                <li>Campanhas</li>
                <li>Movimentações e conferências</li>
                <li>Envios FULL / transferências</li>
                <li>Pedidos e perguntas ML</li>
                <li>Pedidos da loja própria</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-semibold mb-2">Será MANTIDO:</p>
              <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                <li>Contas de empresas</li>
                <li>Usuários e senhas</li>
                <li>Configurações da empresa</li>
                <li>Integração com ML (tokens)</li>
                <li>Planos e assinaturas</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={reset}>Cancelar</Button>
            <Button variant="destructive" onClick={() => setStep("confirm")}>Entendo, continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STEP 2: Confirm text */}
      <Dialog open={step === "confirm"} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="border-destructive/50">
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirmação</DialogTitle>
            <DialogDescription>Digite <span className="font-mono font-bold">CONFIRMAR</span> para prosseguir.</DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="CONFIRMAR"
            className="font-mono"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={reset}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "CONFIRMAR"}
              onClick={() => setStep("password")}
            >
              Próximo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STEP 3: Password */}
      <Dialog open={step === "password" || step === "running"} onOpenChange={(o) => !o && step !== "running" && reset()}>
        <DialogContent className="border-destructive/50">
          <DialogHeader>
            <DialogTitle className="text-destructive">Senha de Administrador</DialogTitle>
            <DialogDescription>Digite sua senha para confirmar a operação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-pwd">Senha</Label>
            <Input
              id="reset-pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={step === "running"}
              autoFocus
            />
          </div>
          {step === "running" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {progress || "Processando..."}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={reset} disabled={step === "running"}>Cancelar</Button>
            <Button variant="destructive" onClick={execute} disabled={!password || step === "running"}>
              {step === "running" ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executando...</> : "Executar Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STEP 4: Success */}
      <Dialog open={step === "success"} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" /> Reset concluído com sucesso!
            </DialogTitle>
            <DialogDescription>Sistema limpo e pronto para uso real.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p>{result?.companies || 0} empresas mantidas</p>
            <p>{result?.users || 0} usuários mantidos</p>
          </div>
          <DialogFooter>
            <Button onClick={reset}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
