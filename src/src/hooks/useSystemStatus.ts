import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: async () => {
      const start = Date.now();
      
      // Check Supabase connection
      const { data: authData, error: authError } = await supabase.auth.getSession();
      const supabaseLatency = Date.now() - start;

      // Mock other statuses for now as requested
      return {
        supabase: {
          status: !authError ? 'online' : 'offline',
          latency: supabaseLatency,
          message: authError ? authError.message : 'Conectado ao Supabase Cloud'
        },
        auth: {
          status: authData?.session ? 'authenticated' : 'available',
          message: authData?.session ? 'Sessão ativa' : 'Pronto para login'
        },
        api: {
          status: 'online',
          latency: Math.floor(Math.random() * 100) + 20,
          message: 'Gateway de API respondendo'
        },
        storage: {
          status: 'online',
          message: 'Buckets acessíveis'
        }
      };
    },
    refetchInterval: 30000,
  });
}
