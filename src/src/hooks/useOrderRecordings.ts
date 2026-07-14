import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RecordingType } from "@/hooks/useOrderRecording";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface OrderRecording {
  id: string;
  pedido_id: string;
  tipo: RecordingType;
  video_url: string;
  duracao_segundos: number;
  responsavel_id: string;
  criado_em: string;
  profiles?: {
    full_name: string | null;
  };
}

export const useOrderRecordings = (pedidoId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  const { data: recordings, isLoading } = useQuery({
    queryKey: ["order-recordings", pedidoId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_recordings")
        .select(`
          *,
          profiles:responsavel_id (
            full_name
          )
        `)
        .eq("pedido_id", pedidoId)
        .eq("company_id", companyId as string)
        .order("criado_em", { ascending: false });

      if (error) throw error;

      // Refresh signed URLs if necessary (assuming video_url might contain an expired one)
      // For better UX, we'll try to sign them on the fly
      const recordingsWithSignedUrls = await Promise.all(
        (data as any[]).map(async (rec) => {
          // If the path is stored in the DB (we might want to add a storage_path column if not already there)
          // For now, let's try to derive it if it follows our pattern
          const path = rec.video_url.includes("token=") 
            ? rec.video_url.split("order_recordings/")[1]?.split("?")[0] 
            : rec.video_url.split("order_recordings/")[1];
            
          if (path) {
            const { data: signedData } = await supabase.storage
              .from("order_recordings")
              .createSignedUrl(path, 60 * 60 * 24 * 7);
            if (signedData) {
              return { ...rec, video_url: signedData.signedUrl };
            }
          }
          return rec;
        })
      );

      return recordingsWithSignedUrls as OrderRecording[];
    },
    enabled: !!pedidoId && !!companyId
  });

  const deleteRecording = useMutation({
    mutationFn: async (recording: OrderRecording) => {
      // 1. Delete from Storage
      const path = recording.video_url.split("/order_recordings/")[1];
      if (path) {
        await supabase.storage.from("order_recordings").remove([path]);
      }

      // 2. Delete from Database
      const { error } = await supabase
        .from("order_recordings")
        .delete()
        .eq("id", recording.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-recordings", pedidoId] });
      toast({ title: "Gravação removida com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover gravação", description: err.message, variant: "destructive" });
    }
  });

  return {
    recordings,
    isLoading,
    deleteRecording: deleteRecording.mutate
  };
};
