import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

/**
 * Hook para acessar o contexto de autenticação do sistema.
 * Fornece a sessão atual, o usuário logado e função de logout.
 * 
 * @returns {AuthContextType} Contexto contendo { session, user, loading, signOut }.
 */
export const useAuth = () => useContext(AuthContext);

/**
 * Provedor de autenticação que envolve a aplicação.
 * Gerencia a persistência da sessão via Supabase e escuta mudanças de estado (login/logout).
 * 
 * @param children - Componentes filhos que terão acesso ao contexto.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const isReady = useRef(false);

  useEffect(() => {
    // 1. Restore session from storage FIRST
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      isReady.current = true;
      setLoading(false);
    });

    // 2. Listen for subsequent auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Skip INITIAL_SESSION — getSession already handles it
        if (event === "INITIAL_SESSION") return;

        setSession(session);
        setUser(session?.user ?? null);

        // Only mark ready if getSession hasn't done it yet
        if (!isReady.current) {
          isReady.current = true;
          setLoading(false);
        }

        // Invalidate queries on real auth events, deferred to next tick
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
          setTimeout(() => {
            queryClient.invalidateQueries();
          }, 0);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
