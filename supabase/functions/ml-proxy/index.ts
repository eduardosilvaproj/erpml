import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { z } from "npm:zod@3.23.8";

const ML_API_BASE = "https://api.mercadolibre.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RequestSchema = z.object({
  itemId: z.string().trim().regex(/^MLB\d+$/i, "ID inválido"),
});

function respond(ok: boolean, payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ ok, ...payload }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  try {
    return JSON.parse(JSON.stringify(error));
  } catch {
    return { value: String(error) };
  }
}

async function validateAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw respond(false, { error: "Não autorizado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw respond(false, { error: "Não autorizado" }, 401);
  }
  return data.claims.sub as string;
}

async function fetchItem(itemId: string, accessToken: string) {
  const res = await fetch(`${ML_API_BASE}/items/${itemId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function refreshToken(refresh_token: string) {
  const clientId = Deno.env.get("MERCADO_LIVRE_APP_ID");
  const clientSecret = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais ML não configuradas no servidor");
  }

  const res = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json?.access_token) {
    throw new Error(`Falha ao renovar token: ${JSON.stringify(json)}`);
  }
  return json as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

Deno.serve(async (req) => {
  console.log("[ml-proxy] req:", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await validateAuth(req);
    console.log("[ml-proxy] userId:", userId);

    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return respond(false, {
        error: "ID inválido. Use o formato MLBxxxxxxxxx",
        diagnostics: { error_stage: "validation", details: parsed.error.flatten() },
      });
    }
    const { itemId } = parsed.data;

    // Service role to read/update tokens
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: connection, error: connErr } = await admin
      .from("ml_connections")
      .select("id, access_token, refresh_token, token_expires_at, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connErr) {
      console.error("[ml-proxy] connErr:", connErr);
    }

    if (!connection?.access_token) {
      return respond(false, {
        error:
          "Conta Mercado Livre não conectada. Conecte sua conta em Vendas → Integração ML.",
        diagnostics: { error_stage: "no_connection" },
      });
    }

    let accessToken = connection.access_token;

    // Proactive refresh if expired
    const expiresAt = connection.token_expires_at
      ? new Date(connection.token_expires_at).getTime()
      : 0;
    if (expiresAt && expiresAt < Date.now() + 60_000 && connection.refresh_token) {
      try {
        console.log("[ml-proxy] Refreshing expired token");
        const tokens = await refreshToken(connection.refresh_token);
        accessToken = tokens.access_token;
        await admin
          .from("ml_connections")
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: new Date(
              Date.now() + tokens.expires_in * 1000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
      } catch (e) {
        console.error("[ml-proxy] refresh failed:", serializeError(e));
      }
    }

    let result = await fetchItem(itemId, accessToken);
    console.log("[ml-proxy] ML status:", result.status);

    // Reactive refresh on 401
    if (result.status === 401 && connection.refresh_token) {
      try {
        const tokens = await refreshToken(connection.refresh_token);
        accessToken = tokens.access_token;
        await admin
          .from("ml_connections")
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: new Date(
              Date.now() + tokens.expires_in * 1000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
        result = await fetchItem(itemId, accessToken);
        console.log("[ml-proxy] retry status:", result.status);
      } catch (e) {
        return respond(false, {
          error:
            "Sessão do Mercado Livre expirada. Reconecte sua conta em Vendas → Integração ML.",
          diagnostics: { error_stage: "refresh_failed", details: serializeError(e) },
        });
      }
    }

    if (result.ok && result.data?.id) {
      return respond(true, {
        data: result.data,
        diagnostics: { source: "ml_authenticated", status: result.status },
      });
    }

    return respond(false, {
      error:
        result.data?.message ||
        result.data?.error ||
        "Não foi possível buscar o anúncio.",
      diagnostics: {
        status: result.status,
        message: result.data?.message ?? null,
        error: result.data?.error ?? null,
        cause: result.data?.cause ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const serialized = serializeError(error);
    console.error("[ml-proxy] internal error:", serialized);
    return respond(false, {
      error: "Erro interno da função",
      diagnostics: { error_stage: "function_error", details: serialized },
    });
  }
});
