import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnansweredMLQuestionsCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

    const channel = supabase
      .channel(`ml-questions-rt-${user.id}`)
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

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // queryClient is stable from the provider, safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return dbCount ?? 0;
}
