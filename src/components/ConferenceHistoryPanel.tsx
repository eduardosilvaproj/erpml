import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Eye, Clock, History, Pause, X, CheckCircle2 } from "lucide-react";
import {
  useConferenceHistory,
  useUpdateConferenceStatus,
  type ConferenceRow,
} from "@/hooks/useConferenceHistory";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  onContinue: (conf: ConferenceRow) => void;
  onView?: (conf: ConferenceRow) => void;
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  em_andamento: { label: "Aguardando conferência", variant: "default" },
  pausada: { label: "Aguardando conferência", variant: "default" },
  conferida: { label: "Conferida", variant: "outline" },
  divergente: { label: "Divergente", variant: "destructive" },
  concluida: { label: "Concluída", variant: "outline" },
  cancelada: { label: "Cancelada", variant: "secondary" },
};

export function ConferenceHistoryPanel({ onContinue, onView }: Props) {
  const [tab, setTab] = useState<"andamento" | "historico">("andamento");
  const updateStatus = useUpdateConferenceStatus();

  const { data: emAndamento, isLoading: loadingAtivas } = useConferenceHistory({
    status: "em_andamento_pausada",
  });
  const { data: historico, isLoading: loadingHist } = useConferenceHistory({ limit: 50 });

  const renderCard = (c: ConferenceRow) => {
    const sb = statusBadge[c.status] ?? { label: c.status, variant: "outline" as const };
    const ativa = c.status === "em_andamento" || c.status === "pausada";
    return (
      <div
        key={c.id}
        role={ativa ? "button" : undefined}
        tabIndex={ativa ? 0 : undefined}
        onClick={ativa ? () => onContinue(c) : undefined}
        onKeyDown={
          ativa
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onContinue(c);
                }
              }
            : undefined
        }
        className={`rounded-lg border p-4 flex flex-col gap-2 transition-colors ${
          ativa
            ? "bg-primary/5 border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)] cursor-pointer hover:bg-primary/10 hover:border-primary"
            : "bg-card"
        }`}
      >
        {ativa && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary -mb-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Clique para continuar de onde parou
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold truncate">
                {c.nome}
              </span>
              <Badge variant={sb.variant}>{sb.label}</Badge>
              <Badge variant="outline" className="text-xs">
                {c.tipo === "inventario"
                  ? (c.section_name ? `Inventário (${c.section_name})` : "Inventário Geral")
                  : "Nota fiscal"}
              </Badge>
            </div>

        {ativa && (
          <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            {c.status === "em_andamento" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateStatus.mutate({ id: c.id, status: "pausada" })}
              >
                <Pause className="h-3 w-3 mr-1" /> Pausar
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateStatus.mutate({ id: c.id, status: "concluida" })}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Concluir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => updateStatus.mutate({ id: c.id, status: "cancelada" })}
            >
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> Conferências
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="andamento">
              Em andamento {emAndamento?.length ? `(${emAndamento.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="andamento" className="space-y-2 mt-3">
            {loadingAtivas ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : !emAndamento?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma conferência em andamento.
              </p>
            ) : (
              emAndamento.map(renderCard)
            )}
          </TabsContent>

          <TabsContent value="historico" className="space-y-2 mt-3 max-h-[480px] overflow-y-auto">
            {loadingHist ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : !historico?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma conferência no histórico.
              </p>
            ) : (
              historico.map(renderCard)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
