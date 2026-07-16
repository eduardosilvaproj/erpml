import { Camera, FileText, Video, Trash2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useReturnEvidence } from "@/hooks/useDevolucoes";

interface ReturnEvidenceProps {
  returnId: string;
}

const typeConfig: Record<string, { icon: any; label: string; color: string }> = {
  video: { icon: Video, label: "Vídeo", color: "text-purple-500" },
  photo: { icon: Camera, label: "Foto", color: "text-blue-500" },
  document: { icon: FileText, label: "Documento", color: "text-orange-500" },
  note: { icon: FileText, label: "Anotação", color: "text-gray-500" },
};

export const ReturnEvidence = ({ returnId }: ReturnEvidenceProps) => {
  const { data: evidence, isLoading } = useReturnEvidence(returnId);

  if (isLoading) {
    return <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!evidence || evidence.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Evidências ({evidence.length})</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {evidence.map((ev) => {
          const cfg = typeConfig[ev.type] || { icon: FileText, label: ev.type, color: "text-gray-500" };
          const Icon = cfg.icon;

          return (
            <Card key={ev.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                  <span className="text-xs font-medium">{cfg.label}</span>
                  {ev.tags?.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
                {ev.description && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{ev.description}</p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  {ev.public_url && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                      <a href={ev.public_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {ev.file_size ? `${(ev.file_size / 1024 / 1024).toFixed(1)}MB` : ""}
                    {ev.duration_seconds ? ` · ${ev.duration_seconds}s` : ""}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};