import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TestAccountResult {
  success: boolean;
  email?: string;
  sessionCreated: boolean;
  message?: string;
}

export async function createTestAccount(): Promise<TestAccountResult> {
  try {
    const { data: limitCheck, error: rpcError } = await supabase.rpc('check_and_log_test_account');
    
    if (rpcError) {
      console.error("RPC Error:", rpcError);
      throw new Error(rpcError.message || "Erro ao verificar limite de contas de teste");
    }
    
    const result = limitCheck as { success: boolean; message: string };
    if (!result.success) {
      return { success: false, sessionCreated: false, message: result.message };
    }

    const randomId = Math.random().toString(36).substring(2, 7);
    const testEmail = `teste_${randomId}@bipstock.com.br`;
    const testPassword = 'teste' + Math.random().toString(36).substring(2, 7);
    const testFullName = `Usuário Teste ${randomId}`;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: { full_name: testFullName }
      }
    });

    if (signUpError) {
      console.error("SignUp Error:", signUpError);
      throw signUpError;
    }

    // Se o usuário foi logado automaticamente (depende da config do Supabase)
    const sessionCreated = !!data.session;

    return { 
      success: true, 
      email: testEmail, 
      sessionCreated 
    };
  } catch (err: any) {
    console.error("createTestAccount error:", err);
    throw err;
  }
}
