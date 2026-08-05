import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReturnStatusStepper } from "@/components/devolucoes/ReturnStatusStepper";
import { ReturnConferenceTab } from "@/components/devolucoes/ReturnConferenceTab";
import { ReturnTimeline } from "@/components/devolucoes/ReturnTimeline";
import { ReturnEvidence } from "@/components/devolucoes/ReturnEvidence";
import { useReturn, useUpdateReturnStatus } from "@/hooks/useDevolucoes";

export default function DevolucaoDetail() {
  const { returnId } = useParams<{ returnId: string }>();
  const navigate = useNavigate();
  const { data: ret, isLoading } = useReturn(returnId);
  const updateStatus = useUpdateReturnStatus();

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (!ret) return <div className="p-6 text-sm text-muted-foreground">Devolução não encontrada.</div>;

  const startConference = () =>
    updateStatus.mutate({ returnId: ret.id, status: "em_conferencia" });
  const conclude = () =>
    updateStatus.mutate({ returnId: ret.id, status: "concluida" });

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/devolucoes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">{ret.numero}</h1>
      </div>

      <Card className="p-4 space-y-4">
        <ReturnStatusStepper status={ret.status} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Origem</div><div>{ret.source}</div></div>
          <div><div className="text-xs text-muted-foreground">Cliente</div><div>{ret.customer_name ?? "-"}</div></div>
          <div><div className="text-xs text-muted-foreground">Referência</div><div>{ret.order_reference ?? "-"}</div></div>
          <div><div className="text-xs text-muted-foreground">Criada em</div><div>{new Date(ret.created_at).toLocaleDateString("pt-BR")}</div></div>
        </div>
        {ret.motivo && (
          <div className="text-sm">
            <div className="text-xs text-muted-foreground">Motivo</div>
            <div>{ret.motivo}</div>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {ret.status === "pendente" && (
            <Button onClick={startConference} disabled={updateStatus.isPending}>Iniciar conferência</Button>
          )}
          {ret.status === "aguardando_decisao" && (
            <Button onClick={conclude} disabled={updateStatus.isPending}>Concluir devolução</Button>
          )}
        </div>
      </Card>

      <Tabs defaultValue="conferencia" className="w-full">
        <TabsList>
          <TabsTrigger value="conferencia">Conferência</TabsTrigger>
          <TabsTrigger value="evidencias">Evidências</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="conferencia" className="mt-4">
          <ReturnConferenceTab returnId={ret.id} />
        </TabsContent>
        <TabsContent value="evidencias" className="mt-4">
          <Card className="p-4"><ReturnEvidence returnId={ret.id} /></Card>
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <Card className="p-4"><ReturnTimeline returnId={ret.id} /></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
