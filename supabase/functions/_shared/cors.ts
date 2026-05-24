const ALLOWED_ORIGINS = [
  "https://stovix.com.br",
  "https://www.stovix.com.br",
  "https://erpml.lovable.app",
  /^https:\/\/.*\.lovable\.app$/,
  /^https:\/\/.*\.lovable\.dev$/,
  "http://localhost:8080",
  "http://localhost:5173",
] as const;

type AllowedOrigin = (typeof ALLOWED_ORIGINS)[number];

function isAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) =>
    allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
  );
}

const COMMON_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export function makeCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = isAllowed(origin) ? origin! : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": COMMON_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    ...(allowed ? { "Vary": "Origin" } : {}),
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { headers: makeCorsHeaders(req) });
}

export const WEBHOOK_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": COMMON_HEADERS,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
