import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnansweredMLQuestionsCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: dbCount } = useQuery({
    queryKey: ["ml-questions-unanswered-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ml_questions")
        .select("id", { count: "exact", head: true })
        .eq("status", "unanswered");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!user) return;

    const channelName = `ml-questions-rt-${user.id}`;

    // Remove any existing channel with the same name to avoid
    // "cannot add callbacks after subscribe()" errors on re-renders / HMR
    const existing = supabase.getChannels().find((ch) => ch.topic === `realtime:${channelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ml_questions",
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["ml-questions-unanswered-count"] });
            queryClient.invalidateQueries({ queryKey: ["ml-questions"] });
          }
        )
        .subscribe();
    } catch (e) {
      console.warn("Realtime não disponível para ml_questions:", (e as Error)?.message);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return dbCount ?? 0;
}
