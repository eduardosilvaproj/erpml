import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const ML_API_BASE = "https://api.mercadolibre.com";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const MAX_ITEMS_TO_SYNC = 1000;
const SEARCH_PAGE_SIZE = 100;
const DETAIL_BATCH_SIZE = 20;

function normalizeText(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

function extractSellerSku(item: any) {
  const rawCandidates = [
    item?.seller_custom_field,
    item?.seller_sku,
    ...(Array.isArray(item?.attributes)
      ? item.attributes
          .filter((a: any) => ["SELLER_SKU", "SELLER_CUSTOM_FIELD"].includes(a?.id))
          .flatMap((a: any) => [a?.value_name, a?.value_id])
      : []),
  ];
  return rawCandidates.map((c) => normalizeText(c)).find(Boolean) ?? null;
}

async function fetchMlJson(url: string, init: RequestInit, ctx: string) {
  const res = await fetch(url, init);
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = payload?.message || payload?.error || res.statusText;
    throw new Error(`${ctx}: ${msg}`);
  }
  return payload;
}

async function refreshToken(supabase: any, conn: any, appId: string, secret: string) {
  if (!conn.refresh_token) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: appId,
    client_secret: secret,
    refresh_token: conn.refresh_token,
  });

  const res = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    console.error(`Refresh failed for user ${conn.user_id}:`, data);
    return null;
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase.from("ml_connections").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? conn.refresh_token,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq("id", conn.id);

  return data.access_token;
}

async function getSellerItems(mlUserId: string, headers: HeadersInit) {
  const allIds: string[] = [];
  let offset = 0;
  let total = 0;

  do {
    const page = await fetchMlJson(
      `${ML_API_BASE}/users/${mlUserId}/items/search?limit=${SEARCH_PAGE_SIZE}&offset=${offset}`,
      { headers }, "Buscar anúncios"
    );
    total = Number(page?.paging?.total ?? 0);
    const ids = Array.isArray(page?.results) ? page.results : [];
    allIds.push(...ids);
    if (!ids.length) break;
    offset += SEARCH_PAGE_SIZE;
  } while (offset < Math.min(total, MAX_ITEMS_TO_SYNC));

  if (!allIds.length) return [];

  const batches: string[][] = [];
  for (let i = 0; i < allIds.length; i += DETAIL_BATCH_SIZE) {
    batches.push(allIds.slice(i, i + DETAIL_BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const details = await fetchMlJson(
        `${ML_API_BASE}/items?ids=${batch.join(",")}`,
        { headers }, "Detalhes anúncios"
      );
      return Array.isArray(details) ? details.map((e: any) => e?.body).filter(Boolean) : [];
    })
  );

  return results.flat();
}

async function syncForConnection(supabase: any, conn: any, accessToken: string) {
  const nowIso = new Date().toISOString();
  const mlHeaders = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  const mlItems = await getSellerItems(conn.ml_user_id, mlHeaders);

  const { data: products } = await supabase
    .from("products")
    .select("id, sku, sku_ml, id_ml, name, stock_physical, stock_full");

  const { data: existingLinks } = await supabase
    .from("ml_linked_products")
    .select("id, ml_item_id, product_id")
    .eq("user_id", conn.user_id);

  const productsByIdMl = new Map<string, any>();
  const productsBySkuMl = new Map<string, any>();
  const productsBySku = new Map<string, any>();

  for (const p of products ?? []) {
    const idMl = normalizeText(p.id_ml);
    const skuMl = normalizeText(p.sku_ml);
    const sku = normalizeText(p.sku);
    if (idMl) productsByIdMl.set(idMl, p);
    if (skuMl) productsBySkuMl.set(skuMl, p);
    if (sku) productsBySku.set(sku, p);
  }

  const linksByItemId = new Map<string, any>();
  for (const l of existingLinks ?? []) linksByItemId.set(l.ml_item_id, l);

  const productUpdates = new Map<string, Record<string, string>>();
  const linksToInsert: any[] = [];
  const linksToUpdate: { id: string; values: Record<string, any> }[] = [];
  const seenItemIds = new Set<string>();
  let matched = 0;

  for (const item of mlItems) {
    const itemId = String(item.id);
    const sellerSku = extractSellerSku(item);

    const product = productsByIdMl.get(normalizeText(itemId))
      || (sellerSku ? productsBySkuMl.get(sellerSku) : undefined)
      || (sellerSku ? productsBySku.get(sellerSku) : undefined);

    if (!product) continue;
    matched++;
    seenItemIds.add(itemId);

    const upd = productUpdates.get(product.id) ?? {};
    if (!normalizeText(product.id_ml)) upd.id_ml = itemId;
    if (sellerSku && !normalizeText(product.sku_ml)) upd.sku_ml = sellerSku;
    if (Object.keys(upd).length) productUpdates.set(product.id, upd);

    const linkValues = {
      user_id: conn.user_id, product_id: product.id, ml_item_id: itemId,
      ml_title: item.title ?? product.name, ml_price: item.price ?? null,
      ml_available_quantity: item.available_quantity ?? null, ml_status: item.status ?? null,
      sync_status: "synced", last_synced_at: nowIso, updated_at: nowIso,
    };

    const existing = linksByItemId.get(itemId);
    if (existing) linksToUpdate.push({ id: existing.id, values: linkValues });
    else linksToInsert.push(linkValues);
  }

  for (const [id, vals] of productUpdates) {
    await supabase.from("products").update(vals).eq("id", id);
  }
  for (const l of linksToUpdate) {
    await supabase.from("ml_linked_products").update(l.values).eq("id", l.id);
  }
  if (linksToInsert.length) {
    await supabase.from("ml_linked_products").insert(linksToInsert);
  }

  const staleIds = (existingLinks ?? [])
    .filter((l: any) => !seenItemIds.has(l.ml_item_id))
    .map((l: any) => l.id);
  if (staleIds.length) {
    await supabase.from("ml_linked_products").delete().in("id", staleIds);
  }

  return { total_items: mlItems.length, matched, removed: staleIds.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appId = Deno.env.get("MERCADO_LIVRE_APP_ID");
  const clientSecret = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET");

  if (!appId || !clientSecret) {
    return new Response(JSON.stringify({ error: "ML credentials missing" }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: connections } = await supabase
    .from("ml_connections")
    .select("*")
    .eq("is_active", true);

  const results: any[] = [];

  for (const conn of connections ?? []) {
    const logId = crypto.randomUUID();
    await supabase.from("ml_sync_logs").insert({
      id: logId, user_id: conn.user_id, sync_type: "auto_catalog", status: "started",
    });

    try {
      let token = conn.access_token;
      const expiresAt = new Date(conn.token_expires_at).getTime();

      if (expiresAt <= Date.now() + TOKEN_REFRESH_BUFFER_MS) {
        token = await refreshToken(supabase, conn, appId, clientSecret);
        if (!token) {
          await supabase.from("ml_sync_logs").update({
            status: "error", error_message: "Token expirado sem refresh_token",
            finished_at: new Date().toISOString(),
          }).eq("id", logId);
          results.push({ user_id: conn.user_id, status: "skipped_no_token" });
          continue;
        }
      }

      const syncResult = await syncForConnection(supabase, conn, token);

      await supabase.from("ml_sync_logs").update({
        status: "completed", items_synced: syncResult.matched,
        details: JSON.stringify(syncResult), finished_at: new Date().toISOString(),
      }).eq("id", logId);

      results.push({ user_id: conn.user_id, ...syncResult });
    } catch (err) {
      console.error(`Auto-sync error for ${conn.user_id}:`, err);
      await supabase.from("ml_sync_logs").update({
        status: "error", error_message: err instanceof Error ? err.message : String(err),
        finished_at: new Date().toISOString(),
      }).eq("id", logId);
      results.push({ user_id: conn.user_id, status: "error" });
    }
  }

  return new Response(JSON.stringify({ synced: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
