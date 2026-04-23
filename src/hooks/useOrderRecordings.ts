import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RecordingType } from "@/hooks/useOrderRecording";
import { useToast } from "@/hooks/use-toast";

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

  const { data: recordings, isLoading } = useQuery({
    queryKey: ["order-recordings", pedidoId],
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
        .order("criado_em", { ascending: false });

      if (error) throw error;
      return data as OrderRecording[];
    },
    enabled: !!pedidoId
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
