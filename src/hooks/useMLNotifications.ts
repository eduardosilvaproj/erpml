import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnansweredMLQuestionsCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [realtimeCount, setRealtimeCount] = useState<number | null>(null);

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
      .channel("ml-questions-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ml_questions",
        },
        () => {
          // Invalidate the count query to refetch
          queryClient.invalidateQueries({ queryKey: ["ml-questions-unanswered-count"] });
          queryClient.invalidateQueries({ queryKey: ["ml-questions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return realtimeCount ?? dbCount ?? 0;
}
