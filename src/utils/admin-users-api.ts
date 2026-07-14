import { supabase } from "@/integrations/supabase/client";

/**
 * Padrão único para chamadas à Edge Function admin-users.
 * Garante que a action seja passada via query string e que não existam headers customizados divergentes.
 */
export async function callAdminUsersFunction<T = any>(action: string, body?: any): Promise<T> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error("[admin-users-api] Session error:", sessionError);
    throw new Error("Erro ao validar sessão. Por favor, faça login novamente.");
  }

  if (!session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  console.log(`[admin-users-api] Calling admin-users function: ${action}`);

  try {
    const { data, error } = await supabase.functions.invoke(`admin-users?action=${action}`, {
      method: 'POST',
      body: body || {},
    });

    if (error) {
      console.error(`[admin-users-api] Function error for ${action}:`, error);
      
      // Mensagens de erro aprimoradas para cenários comuns
      if (error.message?.includes('401') || error.message?.includes('403')) {
        throw new Error("Acesso negado. Apenas administradores podem realizar esta ação.");
      }
      
      if (error.message?.includes('Failed to fetch') || error.name === 'FunctionsHttpError') {
        throw new Error("Não foi possível conectar à função administrativa. Verifique se a Edge Function está implantada.");
      }

      throw new Error(error.message || `Erro ao executar ação administrativa: ${action}`);
    }

    return data as T;
  } catch (error: any) {
    console.error(`[admin-users-api] Request failed for ${action}:`, error);
    
    // Não envolver se já for um erro descritivo que lançamos acima
    if (error.message && (
      error.message.includes("Acesso negado") || 
      error.message.includes("Sessão expirada") ||
      error.message.includes("conectar à função")
    )) {
      throw error;
    }
    
    throw new Error(error.message || "Erro inesperado de rede ao acessar o servidor administrativo.");
  }
}
