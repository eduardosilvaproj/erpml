import { useEffect, useState, useRef } from "react";
import { Camera, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReturnEvidence, useUploadReturnEvidence } from "@/hooks/useDevolucoes";
import { returnsService } from "@/services/returns";

export function ReturnEvidence({ returnId }: { returnId: string }) {
  const { data: evidence = [] } = useReturnEvidence(returnId);
  const upload = useUploadReturnEvidence();
  const fileRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const next: Record<string, string> = {};
      for (const e of evidence as any[]) {
        try {
          next[e.id] = await returnsService.signedUrl(e.storage_path, e.bucket);
        } catch {}
      }
      setUrls(next);
    })();
  }, [evidence]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await upload.mutateAsync({ returnId, file });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <ImageIcon className="h-4 w-4" /> Evidências
        </h4>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
            <Upload className="h-4 w-4 mr-1" /> Anexar
          </Button>
        </div>
      </div>
      {evidence.length === 0 ? (
        <div className="text-sm text-muted-foreground rounded-md border border-dashed p-6 text-center">
          <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhuma evidência anexada
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(evidence as any[]).map(e => (
            <a key={e.id} href={urls[e.id]} target="_blank" rel="noreferrer" className="block rounded-md overflow-hidden border">
              {urls[e.id] ? (
                <img src={urls[e.id]} alt="" className="aspect-square object-cover w-full" />
              ) : (
                <div className="aspect-square bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  Carregando...
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
