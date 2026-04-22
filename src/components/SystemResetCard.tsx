import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Trash2, Loader2, CheckCircle2, PlayCircle, Eye, Table as TableIcon, Code } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type Step = "idle" | "warn" | "confirm" | "password" | "running" | "success" | "dry_run_results";

export default function SystemResetCard() {
  const [step, setStep] = useState<Step>("idle");
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [progress, setProgress] = useState("");
  const [isDryRun, setIsDryRun] = useState(false);
  const [result, setResult] = useState<{ 
    companies: number; 
    users: number; 
    sql?: string; 
    tables?: { name: string; count: number }[] 
  } | null>(null);

  const reset = () => {
    setStep("idle");
    setConfirmText("");
    setPassword("");
    setProgress("");
    setResult(null);
    setIsDryRun(false);
  };

  const execute = async (dryRun: boolean = false) => {
    setIsDryRun(dryRun);
    setStep("running");
    setProgress(dryRun ? "Simulando reset..." : "Validando credenciais...");
    try {
      const { data, error } = await supabase.functions.invoke("system-reset", {
        body: { password, confirmation: confirmText, dryRun },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setResult({ 
        companies: data.companies || 0, 
        users: data.users || 0,
        sql: data.sql,
        tables: data.tables
      });
      
      setStep(dryRun ? "dry_run_results" : "success");
    } catch (e: any) {
      toast.error(e.message || `Falha ao ${dryRun ? "simular" : "executar"} reset`);
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
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => setStep("warn")}>
              <Trash2 className="h-4 w-4 mr-2" /> Executar Reset Geral
            </Button>
            <Button variant="outline" onClick={() => { setIsDryRun(true); setStep("confirm"); }}>
              <Eye className="h-4 w-4 mr-2" /> Simular Reset (Dry-run)
            </Button>
          </div>
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={reset} disabled={step === "running"}>Cancelar</Button>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                onClick={() => execute(true)} 
                disabled={!password || step === "running"}
              >
                {step === "running" && isDryRun ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                Simular
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => execute(false)} 
                disabled={!password || step === "running"}
              >
                {step === "running" && !isDryRun ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Executar Reset
              </Button>
            </div>
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

      {/* STEP 5: Dry Run Results */}
      <Dialog open={step === "dry_run_results"} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> Resultado da Simulação
            </DialogTitle>
            <DialogDescription>
              Abaixo estão as tabelas que seriam afetadas e o SQL exato que seria executado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
              <div className="flex flex-col overflow-hidden">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <TableIcon className="h-4 w-4" /> Tabelas Afetadas
                </h4>
                <ScrollArea className="flex-1 border rounded-md p-2 bg-muted/20">
                  <div className="space-y-1">
                    {result?.tables?.map((t) => (
                      <div key={t.name} className="flex items-center justify-between text-xs p-1 rounded hover:bg-muted/50">
                        <span className="font-mono">{t.name}</span>
                        <Badge variant={t.count > 0 ? "destructive" : "secondary"}>
                          {t.count === -1 ? "Erro" : `${t.count} registros`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex flex-col overflow-hidden">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Code className="h-4 w-4" /> SQL Preview (TRUNCATE/CASCADE)
                </h4>
                <ScrollArea className="flex-1 border rounded-md p-2 bg-slate-950 text-slate-50">
                  <pre className="text-[10px] font-mono whitespace-pre-wrap leading-tight">
                    {result?.sql}
                  </pre>
                </ScrollArea>
              </div>
            </div>

            <div className="rounded-lg border bg-blue-500/10 p-3 text-xs flex items-start gap-2 border-blue-500/20">
              <PlayCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-700">Esta foi apenas uma simulação.</p>
                <p className="text-blue-600">Nenhum dado foi alterado no banco de dados. {result?.companies} empresas e {result?.users} usuários seriam mantidos.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={reset}>Fechar</Button>
            <Button variant="destructive" onClick={() => setStep("password")}>
              Ir para Execução Real
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
