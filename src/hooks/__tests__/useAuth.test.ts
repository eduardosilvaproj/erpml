import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth, AuthProvider } from "../../contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ReactNode, createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(),
    },
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => 
  createElement(QueryClientProvider, { client: queryClient }, 
    createElement(AuthProvider, null, children)
  );

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle login session", async () => {
    const mockSession = { user: { id: "123", email: "test@example.com" } };
    (supabase.auth.getSession as any).mockResolvedValue({ data: { session: mockSession } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toEqual(mockSession);
    expect(result.current.user?.email).toBe("test@example.com");
  });

  it("should handle logout", async () => {
    (supabase.auth.signOut as any).mockResolvedValue({ error: null });
    
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await result.current.signOut();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});
