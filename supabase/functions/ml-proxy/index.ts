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

const browserHeaders = {
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
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
    throw new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Response(JSON.stringify({ error: "Configuração do backend ausente" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    throw new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return claimsData.claims.sub;
}

async function fetchAttempt(url: string, label: string) {
  console.log(`[ml-proxy] Fazendo fetch (${label}): ${url}`);

  const response = await fetch(url, {
    headers: browserHeaders,
  });

  const responseHeaders = Object.fromEntries(response.headers.entries());
  console.log(`[ml-proxy] Status (${label}): ${response.status}`);
  console.log(`[ml-proxy] Headers (${label}):`, responseHeaders);

  const rawText = await response.text();
  console.log(`[ml-proxy] Body (${label}): ${rawText.slice(0, 2000)}`);

  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = { raw: rawText };
  }

  return {
    ok: response.ok,
    status: response.status,
    headers: responseHeaders,
    data,
  };
}

Deno.serve(async (req) => {
  console.log("[ml-proxy] Requisição recebida:", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await validateAuth(req);
    console.log("[ml-proxy] Usuário autenticado:", userId);

    const body = await req.json().catch(() => null);
    console.log("[ml-proxy] Body recebido:", body);

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[ml-proxy] ID inválido:", parsed.error.flatten());
      return jsonResponse(
        {
          error: "ID inválido",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const { itemId } = parsed.data;
    console.log("[ml-proxy] ItemId recebido:", itemId);

    const attempts: Array<Record<string, unknown>> = [];

    const directUrl = `${ML_API_BASE}/items/${itemId}`;
    const directResult = await fetchAttempt(directUrl, "direto");
    attempts.push({ source: "direto", status: directResult.status, ok: directResult.ok });

    if (directResult.ok && directResult.data?.id) {
      console.log("[ml-proxy] Sucesso na chamada direta:", itemId);
      return jsonResponse(directResult.data);
    }

    console.error("[ml-proxy] Erro do ML na chamada direta:", directResult.status, directResult.data);

    const proxyAttempts = [
      {
        source: "allorigins",
        url: `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`,
      },
      {
        source: "corsproxy",
        url: `https://corsproxy.io/?${encodeURIComponent(directUrl)}`,
      },
      {
        source: "thingproxy",
        url: `https://thingproxy.freeboard.io/fetch/${directUrl}`,
      },
      {
        source: "codetabs",
        url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(directUrl)}`,
      },
    ];

    for (const proxy of proxyAttempts) {
      try {
        const proxyResult = await fetchAttempt(proxy.url, proxy.source);
        attempts.push({ source: proxy.source, status: proxyResult.status, ok: proxyResult.ok });

        if (proxyResult.ok && proxyResult.data?.id) {
          console.log(`[ml-proxy] Sucesso via proxy ${proxy.source}:`, itemId);
          return jsonResponse(proxyResult.data);
        }
      } catch (proxyError) {
        const serialized = serializeError(proxyError);
        console.error(`[ml-proxy] Falha no proxy ${proxy.source}:`, serialized);
        attempts.push({ source: proxy.source, error: serialized });
      }
    }

    return jsonResponse(
      {
        error: directResult.data?.message || directResult.data?.error || "Anúncio não encontrado",
        status: directResult.status,
        message: directResult.data?.message || null,
        cause: directResult.data?.cause || null,
        error_type: directResult.data?.error_type || null,
        blocked_by: directResult.data?.blocked_by || null,
        attempts,
      },
      directResult.status >= 400 ? directResult.status : 502,
    );
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    const serialized = serializeError(error);
    console.error("[ml-proxy] Erro interno:", serialized);
    return jsonResponse(
      {
        error: "Erro interno na função",
        details: serialized,
      },
      500,
    );
  }
});
