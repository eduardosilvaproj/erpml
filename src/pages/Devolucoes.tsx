import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import { ReturnsListTab } from "@/components/devolucoes/ReturnsListTab";
import { QuarantinePanel } from "@/components/devolucoes/QuarantinePanel";
import { ReturnForm } from "@/components/devolucoes/ReturnForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useCompanyId } from "@/hooks/useCompanyId";

export default function Devolucoes() {
  const [formOpen, setFormOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = useCompanyId();

  const handleSyncML = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ml-returns-sync", {
        body: { companyId },
      });
      if (error) throw error;
      const raw = JSON.stringify(data, null, 2);
      console.log("[ml-returns-sync DIAG]", raw);
      toast({
        title: "Diagnóstico ML (ver console)",
        description: raw.slice(0, 500),
      });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
    } catch (e: any) {
      toast({
        title: "Erro ao sincronizar",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-base font-semibold leading-tight">Devoluções e retiradas</h1>
          <p className="text-xs text-muted-foreground">Conferência, decisão e quarentena</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={handleSyncML} disabled={syncing}>
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            {syncing ? "Sincronizando…" : "Sincronizar ML"}
          </Button>
          <Button size="sm" className="h-8" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova devolução
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList className="h-8 w-full flex-wrap justify-start">
          <TabsTrigger value="pendentes" className="text-xs">Pendentes</TabsTrigger>
          <TabsTrigger value="conferencia" className="text-xs">Em conferência</TabsTrigger>
          <TabsTrigger value="decisao" className="text-xs">Aguardando decisão</TabsTrigger>
          <TabsTrigger value="concluidas" className="text-xs">Concluídas</TabsTrigger>
          <TabsTrigger value="quarentena" className="text-xs">Quarentena</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes" className="mt-3"><ReturnsListTab status="pendente" /></TabsContent>
        <TabsContent value="conferencia" className="mt-3"><ReturnsListTab status="em_conferencia" /></TabsContent>
        <TabsContent value="decisao" className="mt-3"><ReturnsListTab status="aguardando_decisao" /></TabsContent>
        <TabsContent value="concluidas" className="mt-3"><ReturnsListTab status="concluida" /></TabsContent>
        <TabsContent value="quarentena" className="mt-3"><QuarantinePanel /></TabsContent>
      </Tabs>

      <ReturnForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
