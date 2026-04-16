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
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw respond(false, { error: "Não autorizado" }, 401);
  }
  return data.claims.sub as string;
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  Origin: "https://www.mercadolivre.com.br",
  Referer: "https://www.mercadolivre.com.br/",
  "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  Connection: "keep-alive",
};

async function parseResponse(res: Response) {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function fetchItemBrowser(itemId: string, accessToken?: string) {
  const headers: Record<string, string> = { ...BROWSER_HEADERS };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  // 1) endpoint padrão /items/:id
  const r1 = await fetch(`${ML_API_BASE}/items/${itemId}`, { headers });
  console.log("[ml-proxy] /items/:id status:", r1.status);
  const p1 = await parseResponse(r1);
  if (p1.ok && p1.data?.id) {
    return { ...p1, source: "items_single", attempts: ["items_single"] };
  }

  // 2) fallback /items?ids=:id (multiget)
  const r2 = await fetch(`${ML_API_BASE}/items?ids=${itemId}`, { headers });
  console.log("[ml-proxy] /items?ids status:", r2.status);
  const p2 = await parseResponse(r2);
  if (p2.ok && Array.isArray(p2.data) && p2.data[0]?.code === 200 && p2.data[0]?.body?.id) {
    return {
      status: 200,
      ok: true,
      data: p2.data[0].body,
      source: "items_multiget",
      attempts: ["items_single", "items_multiget"],
    };
  }

  return {
    ...p1,
    source: "failed",
    attempts: ["items_single", "items_multiget"],
    fallback: { status: p2.status, data: p2.data },
  };
}

async function refreshToken(refresh_token: string) {
  const clientId = Deno.env.get("MERCADO_LIVRE_APP_ID");
  const clientSecret = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Credenciais ML não configuradas");

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
  return json as { access_token: string; refresh_token: string; expires_in: number };
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

    // Tenta obter token ML (opcional — melhora taxa de sucesso)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: connection } = await admin
      .from("ml_connections")
      .select("id, access_token, refresh_token, token_expires_at, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let accessToken: string | undefined = connection?.access_token;

    // Refresh proativo se expirado
    if (connection?.refresh_token && connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at).getTime();
      if (expiresAt && expiresAt < Date.now() + 60_000) {
        try {
          const t = await refreshToken(connection.refresh_token);
          accessToken = t.access_token;
          await admin
            .from("ml_connections")
            .update({
              access_token: t.access_token,
              refresh_token: t.refresh_token,
              token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", connection.id);
        } catch (e) {
          console.error("[ml-proxy] refresh failed:", serializeError(e));
        }
      }
    }

    let result = await fetchItemBrowser(itemId, accessToken);

    // Refresh reativo no 401
    if (result.status === 401 && connection?.refresh_token) {
      try {
        const t = await refreshToken(connection.refresh_token);
        accessToken = t.access_token;
        await admin
          .from("ml_connections")
          .update({
            access_token: t.access_token,
            refresh_token: t.refresh_token,
            token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
        result = await fetchItemBrowser(itemId, accessToken);
      } catch (e) {
        console.error("[ml-proxy] reactive refresh failed:", serializeError(e));
      }
    }

    if (result.ok && result.data?.id) {
      return respond(true, {
        data: result.data,
        diagnostics: {
          source: result.source,
          attempts: result.attempts,
          authenticated: !!accessToken,
        },
      });
    }

    return respond(false, {
      error:
        result.data?.message ||
        result.data?.error ||
        "Não foi possível buscar o anúncio.",
      diagnostics: {
        status: result.status,
        attempts: result.attempts,
        message: result.data?.message ?? null,
        error: result.data?.error ?? null,
        cause: result.data?.cause ?? null,
        fallback: (result as any).fallback ?? null,
        authenticated: !!accessToken,
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
