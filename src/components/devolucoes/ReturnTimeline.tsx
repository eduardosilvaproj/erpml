import { Clock } from "lucide-react";
import { useReturnActions } from "@/hooks/useDevolucoes";

export function ReturnTimeline({ returnId }: { returnId: string }) {
  const { data: actions = [], isLoading } = useReturnActions(returnId);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando histórico...</div>;
  }
  if (actions.length === 0) {
    return <div className="text-sm text-muted-foreground">Nenhuma ação registrada.</div>;
  }
  return (
    <ol className="space-y-3">
      {actions.map((a: any) => (
        <li key={a.id} className="flex gap-3">
          <div className="flex-shrink-0 mt-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="flex-1 border-b border-border pb-3">
            <div className="text-sm font-medium">{a.action}</div>
            {a.details && Object.keys(a.details).length > 0 && (
              <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(a.details, null, 2)}
              </pre>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {new Date(a.created_at).toLocaleString("pt-BR")}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
