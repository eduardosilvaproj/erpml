// TEMPORÁRIO — sonda de descoberta de INBOUNDS do Full.
// Read-only: NÃO cria nem altera nada. Remover após a descoberta.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const ML_API_BASE = "https://api.mercadolibre.com";
const TARGET_SELLER = "1075018916"; // conta com Full
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
async function probe(url: string, token: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init?.headers ?? {}) },
      signal: ctrl.signal,
    });
    const text = await res.text();
    let body: unknown = text;
    try { body = JSON.parse(text); } catch (_) {}
    return { url, status: res.status, body };
  } catch (e) {
    return { url, status: -1, body: `fetch_error: ${(e as Error).message}` };
  } finally {
    clearTimeout(t);
  }
}
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: conn } = await supabase
    .from("ml_connections")
    .select("*")
    .eq("ml_user_id", TARGET_SELLER)
    .eq("is_active", true)
    .maybeSingle();
  if (!conn) {
    return new Response(JSON.stringify({ error: `Sem conexão ativa para seller ${TARGET_SELLER}` }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  let token = conn.access_token as string;
  if (conn.refresh_token && new Date(conn.token_expires_at ?? 0) < new Date()) {
    const appId = Deno.env.get("MERCADO_LIVRE_APP_ID");
    const secret = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET");
    if (appId && secret) {
      const r = await fetch(`${ML_API_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token", client_id: appId, client_secret: secret, refresh_token: conn.refresh_token,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.access_token) {
        token = d.access_token;
        await supabase.from("ml_connections").update({
          access_token: token,
          refresh_token: d.refresh_token ?? conn.refresh_token,
          token_expires_at: new Date(Date.now() + (d.expires_in ?? 3600) * 1000).toISOString(),
        }).eq("id", conn.id);
      }
    }
  }
  const out: Record<string, unknown> = { seller_id: TARGET_SELLER };
  // PASSO 1 — itens Full do vendedor
  const itemsSearch = await probe(`${ML_API_BASE}/users/${TARGET_SELLER}/items/search?limit=20`, token);
  out.step1_items_search = itemsSearch;
  const inventoryIds: string[] = [];
  const itemIds: string[] = Array.isArray((itemsSearch.body as any)?.results)
    ? (itemsSearch.body as any).results.slice(0, 10)
    : [];
  const itemDetails: unknown[] = [];
  for (const mlb of itemIds.slice(0, 5)) {
    const det = await probe(`${ML_API_BASE}/items/${mlb}?include_attributes=all`, token);
    const b = det.body as any;
    const inv = b?.inventory_id
      ?? b?.shipping?.inventory_id
      ?? (Array.isArray(b?.variations) ? b.variations.find((v: any) => v?.inventory_id)?.inventory_id : null);
    if (inv) inventoryIds.push(String(inv));
    itemDetails.push({ mlb, status: det.status, inventory_id: inv ?? null, logistic_type: b?.shipping?.logistic_type ?? null });
  }
  out.step2_item_details = itemDetails;
  out.inventory_ids_found = inventoryIds;
  // PASSO 3 — operations/search com inventory_id
  const opsProbes: unknown[] = [];
  for (const inv of inventoryIds.slice(0, 2)) {
    opsProbes.push(await probe(
      `${ML_API_BASE}/stock/fulfillment/operations/search?seller_id=${TARGET_SELLER}&inventory_id=${inv}`,
      token,
    ));
  }
  out.step3_operations_with_inventory = opsProbes;
  // PASSO 4 — inbound como BUSCA (seller_id), não por-ID
  const inboundSearchUrls = [
    `${ML_API_BASE}/inbounds/search?seller_id=${TARGET_SELLER}`,
    `${ML_API_BASE}/inbound/shipments/search?seller_id=${TARGET_SELLER}`,
    `${ML_API_BASE}/stock/fulfillment/inbounds/search?seller_id=${TARGET_SELLER}`,
    `${ML_API_BASE}/stock/fulfillment/inbound/search?seller_id=${TARGET_SELLER}`,
    `${ML_API_BASE}/shipments/fulfillment/inbounds/search?seller_id=${TARGET_SELLER}`,
  ];
  const inboundSearch: unknown[] = [];
  for (const u of inboundSearchUrls) inboundSearch.push(await probe(u, token));
  out.step4_inbound_search = inboundSearch;
  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
