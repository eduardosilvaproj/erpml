import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Stethoscope } from "lucide-react";
import { GravacoesFullTab } from "@/components/GravacoesFullTab";
import { OrdensFullTab } from "@/components/OrdensFullTab";
import { useSyncFullOrders, type FullSyncDryRunResult } from "@/hooks/useMLData";
import { useToast } from "@/hooks/use-toast";

const MovimentacaoFull = () => {
  const syncFull = useSyncFullOrders();
  const { toast } = useToast();

  const handleSyncNow = async () => {
    try {
      const res = await syncFull.mutateAsync(undefined);
      const criados = (res as any)?.synced ?? 0;
      toast({
        title: criados > 0 ? `${criados} pedido(s) Full sincronizado(s)` : "Sincronização concluída",
        description: criados > 0
          ? "Novos pedidos foram adicionados às ordens."
          : "Nenhum pedido novo encontrado no Mercado Livre.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
    }
  };

  const handleDiagnose = async () => {
    try {
      const res = (await syncFull.mutateAsync({ dryRun: true })) as FullSyncDryRunResult;
      const diags = res?.diagnostics ?? [];
      if (!diags.length) {
        toast({
          title: "Diagnóstico concluído",
          description: "Nenhuma conta ML com sincronização configurada foi encontrada.",
        });
        return;
      }
      // eslint-disable-next-line no-console
      console.log("[ml-full-sync dry-run]", diags);

      const comErro = diags.find((d) => d.ml_error);
      if (comErro) {
        toast({
          title: `Erro na API do ML (HTTP ${comErro.ml_status ?? "?"})`,
          description: comErro.ml_error,
          variant: "destructive",
        });
        return;
      }

      const pagos = diags.reduce((s, d) => s + (d.total_pagos ?? 0), 0);
      const full = diags.reduce((s, d) => s + (d.total_full ?? 0), 0);
      const janela = diags.reduce((s, d) => s + (d.na_janela_30d ?? 0), 0);
      const jaPainel = diags.reduce((s, d) => s + (d.ja_no_painel ?? 0), 0);
      const comVinculo = diags.reduce((s, d) => s + (d.novos_com_vinculo ?? 0), 0);
      const semVinculo = diags.reduce((s, d) => s + (d.novos_sem_vinculo ?? 0), 0);
      toast({
        title: "Diagnóstico (últimos 30 dias)",
        description:
          `Pagos retornados: ${pagos} • Full: ${full} • na janela: ${janela} • ` +
          `já no painel: ${jaPainel} • novos c/ vínculo: ${comVinculo} • novos s/ vínculo: ${semVinculo}`,
      });
    } catch (e: any) {
      toast({ title: "Erro no diagnóstico", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Movimentação Físico → FULL</h1>
          <p className="text-muted-foreground">Envie produtos do estoque físico para o FULL Mercado Livre</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={handleDiagnose}
            disabled={syncFull.isPending}
            className="shrink-0"
          >
            {syncFull.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Stethoscope className="mr-2 h-4 w-4" />
            )}
            Diagnosticar (30d)
          </Button>
          <Button onClick={handleSyncNow} disabled={syncFull.isPending} className="shrink-0">
            {syncFull.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar pedidos Full agora
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ordens" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ordens">📋 Ordens</TabsTrigger>
          <TabsTrigger value="gravacoes">🎥 Gravações</TabsTrigger>
        </TabsList>

        <TabsContent value="ordens" className="mt-0">
          <OrdensFullTab />
        </TabsContent>

        <TabsContent value="gravacoes" className="mt-0">
          <GravacoesFullTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MovimentacaoFull;
