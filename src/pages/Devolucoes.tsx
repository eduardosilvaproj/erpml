import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Undo2, Search, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useAuth } from "@/contexts/AuthContext";
import { useReturns, useCreateReturn } from "@/hooks/useDevolucoes";
import { ReturnsListTab } from "@/components/devolucoes/ReturnsListTab";
import { QuarantinePanel } from "@/components/devolucoes/QuarantinePanel";
import { ReturnForm } from "@/components/devolucoes/ReturnForm";

const TAB_LABELS = ["Pendentes", "Em Conferência", "Aguardando Decisão", "Concluídas", "Quarentena"];

const Devolucoes = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const queryClient = useQueryClient();

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase.functions.invoke("ml-returns-sync", {
        body: { dryRun: false },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Sincronização concluída", description: data?.message || "Devoluções atualizadas." });
      queryClient.invalidateQueries({ queryKey: ["returns"] });
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const { data: returns, isLoading } = useReturns();
  const createReturn = useCreateReturn();

  const statusMap: Record<string, string> = {
    pendentes: "pendente_recebimento",
    em_conferencia: "em_conferencia",
    aguardando: "aguardando_decisao",
    concluidas: "concluida",
  };

  const filteredReturns = returns?.filter((r) => {
    const statusFilter = statusMap[activeTab];
    if (statusFilter && r.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.ml_order_id?.toLowerCase().includes(q) ||
        r.ml_return_id?.toLowerCase().includes(q) ||
        r.motivo?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreateReturn = async (data: {
    ml_order_id?: string; motivo?: string; notes?: string;
    items: { product_id: string; nome_produto: string; sku?: string; expected_quantity: number }[];
  }) => {
    try {
      await createReturn.mutateAsync(data);
      toast({ title: "Devolução criada!", description: "Aguardando recebimento." });
      setCreateDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Undo2 className="h-6 w-6 text-primary" /> Devoluções e Retiradas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie devoluções do Mercado Livre e retiradas de estoque
          </p>
        </div>
        <Button onClick={handleManualSync} variant="outline" className="gap-1" disabled={isSyncing}>
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar ML
        </Button>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-1">
          <Plus className="h-4 w-4" /> Nova Devolução
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por pedido ML, motivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="em_conferencia">Em Conferência</TabsTrigger>
          <TabsTrigger value="aguardando">Aguard. Decisão</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
          <TabsTrigger value="quarentena">Quarentena</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes">
          <ReturnsListTab returns={filteredReturns} isLoading={isLoading} status="pendente_recebimento" />
        </TabsContent>
        <TabsContent value="em_conferencia">
          <ReturnsListTab returns={filteredReturns} isLoading={isLoading} status="em_conferencia" />
        </TabsContent>
        <TabsContent value="aguardando">
          <ReturnsListTab returns={filteredReturns} isLoading={isLoading} status="aguardando_decisao" />
        </TabsContent>
        <TabsContent value="concluidas">
          <ReturnsListTab returns={filteredReturns} isLoading={isLoading} status="concluida" />
        </TabsContent>
        <TabsContent value="quarentena">
          <QuarantinePanel />
        </TabsContent>
      </Tabs>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Devolução</DialogTitle>
          </DialogHeader>
          <ReturnForm
            onSubmit={handleCreateReturn}
            onCancel={() => setCreateDialogOpen(false)}
            isSaving={createReturn.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Devolucoes;