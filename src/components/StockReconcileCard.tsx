import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { stockService } from "@/services/stock";

interface ReconcileResult {
  total: number;
  corrected: number;
  details: {
    productId: string;
    name: string;
    oldPhysical: number;
    newPhysical: number;
    oldFull: number;
    newFull: number;
  }[];
}

interface AllCompaniesResult {
  companiesProcessed: number;
  totalCorrected: number;
  perCompany: { companyId: string; companyName: string; total: number; corrected: number }[];
}

export default function StockReconcileCard() {
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [running, setRunning] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [allResult, setAllResult] = useState<AllCompaniesResult | null>(null);

  const handleReconcile = async () => {
    if (!companyId) {
      toast({ title: "Empresa não identificada", variant: "destructive" });
      return;
    }

    setRunning(true);
    setResult(null);

    try {
      const res = await stockService.reconcileStock(companyId);
      setResult(res);

      if (res.corrected === 0) {
        toast({ title: "Estoque já está correto", description: `${res.total} produtos verificados, nenhuma correção necessária.` });
      } else {
        toast({ title: "Reconciliação concluída", description: `${res.corrected} de ${res.total} produtos corrigidos.` });
      }
    } catch (err: any) {
      toast({ title: "Erro na reconciliação", description: err.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const handleReconcileAll = async () => {
    setRunningAll(true);
    setAllResult(null);

    try {
      const res = await stockService.reconcileAllCompanies();
      setAllResult(res);

      if (res.totalCorrected === 0) {
        toast({ title: "Todas as empresas estão corretas", description: `${res.companiesProcessed} empresas verificadas.` });
      } else {
        toast({ title: "Reconciliação global concluída", description: `${res.totalCorrected} produtos corrigidos em ${res.companiesProcessed} empresas.` });
      }
    } catch (err: any) {
      toast({ title: "Erro na reconciliação global", description: err.message, variant: "destructive" });
    } finally {
      setRunningAll(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Reconciliação de Estoque
        </CardTitle>
        <CardDescription>
          Recalcula o estoque físico e Full de todos os produtos baseado nos movimentos registrados.
          Use quando houver divergência entre o estoque exibido e o real.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Button onClick={handleReconcile} disabled={running} variant="destructive">
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Reconciliando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Executar Reconciliação
              </>
            )}
          </Button>
          {result && (
            <Badge variant={result.corrected > 0 ? "destructive" : "default"} className="text-sm">
              {result.corrected > 0 ? (
                <><AlertTriangle className="h-3 w-3 mr-1" /> {result.corrected} corrigidos</>
              ) : (
                <><CheckCircle2 className="h-3 w-3 mr-1" /> Tudo correto</>
              )}
            </Badge>
          )}
        </div>

        {result && result.details.length > 0 && (
          <ScrollArea className="h-[300px] border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Físico (antes)</TableHead>
                  <TableHead className="text-right">Físico (corrigido)</TableHead>
                  <TableHead className="text-right">Full (antes)</TableHead>
                  <TableHead className="text-right">Full (corrigido)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.details.map((d) => (
                  <TableRow key={d.productId}>
                    <TableCell className="font-medium max-w-[200px] truncate">{d.name}</TableCell>
                    <TableCell className="text-right text-destructive">{d.oldPhysical}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-bold">{d.newPhysical}</TableCell>
                    <TableCell className="text-right text-destructive">{d.oldFull}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-bold">{d.newFull}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {result && result.details.length === 0 && result.corrected === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
            <p>Todos os {result.total} produtos estão com estoque correto.</p>
          </div>
        )}

        <div className="border-t pt-4 mt-4">
          <p className="text-sm text-muted-foreground mb-3">
            Reconciliar todas as empresas do sistema (admin master):
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={handleReconcileAll} disabled={runningAll} variant="outline">
              {runningAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Reconciliando todas...
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 mr-2" />
                  Reconciliar Todas as Empresas
                </>
              )}
            </Button>
            {allResult && (
              <Badge variant={allResult.totalCorrected > 0 ? "destructive" : "default"} className="text-sm">
                {allResult.totalCorrected > 0 ? (
                  <><AlertTriangle className="h-3 w-3 mr-1" /> {allResult.totalCorrected} corrigidos em {allResult.companiesProcessed} empresas</>
                ) : (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Todas corretas</>
                )}
              </Badge>
            )}
          </div>

          {allResult && allResult.perCompany.length > 0 && (
            <ScrollArea className="h-[200px] border rounded-lg mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Produtos</TableHead>
                    <TableHead className="text-right">Corrigidos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allResult.perCompany.map((c) => (
                    <TableRow key={c.companyId}>
                      <TableCell className="font-medium">{c.companyName}</TableCell>
                      <TableCell className="text-right">{c.total}</TableCell>
                      <TableCell className="text-right">
                        {c.corrected === -1 ? (
                          <Badge variant="destructive">Erro</Badge>
                        ) : c.corrected > 0 ? (
                          <span className="text-amber-500 font-bold">{c.corrected}</span>
                        ) : (
                          <span className="text-emerald-500">✓</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
