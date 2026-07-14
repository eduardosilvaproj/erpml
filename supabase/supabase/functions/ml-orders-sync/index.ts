
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { WEBHOOK_CORS_HEADERS } from "../_shared/cors.ts";

const ML_API_BASE = "https://api.mercadolibre.com";
const PAGE_SIZE = 50;
const SYNC_WINDOW_DAYS = 90;
const MAX_ORDERS = 500;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...WEBHOOK_CORS_HEADERS },
  });

function normalizeText(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
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

async function refreshToken(
  supabase: any,
  conn: any,
  appId: string,
  secret: string
): Promise<string | null> {
  if (!conn.refresh_token) return conn.access_token ?? null;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: appId,
    client_secret: secret,
    refresh_token: conn.refresh_token,
  });
  const res = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    console.error(`[ml-orders-sync] Refresh failed for user ${conn.user_id}:`, data);
    return null;
  }
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase
    .from("ml_connections")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? conn.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);
  return data.access_token;
}

async function syncOrdersForConnection(supabase: any, conn: any, token: string) {
  const userId = conn.user_id;
  const companyId = conn.company_id ?? null;
  const sellerId = conn.ml_user_id;
  if (!sellerId) return { user_id: userId, status: "no_seller_id" };

  const cutoff = new Date(Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const allOrders: any[] = [];
  let offset = 0;
  let totalInMl = 0;
  do {
    const page = await fetchMlJson(
      `${ML_API_BASE}/orders/search?seller=${sellerId}` +
        `&sort=date_desc&limit=${PAGE_SIZE}&offset=${offset}` +
        `&order.date_created.from=${encodeURIComponent(cutoff)}`,
      { headers: { Authorization: `Bearer ${token}` } },
      "Buscar pedidos"
    );
    totalInMl = Number(page?.paging?.total ?? 0);
    const results = Array.isArray(page?.results) ? page.results : [];
    allOrders.push(...results);
    if (!results.length) break;
    offset += PAGE_SIZE;
  } while (offset < Math.min(totalInMl, MAX_ORDERS));

  if (allOrders.length === 0) {
    return { user_id: userId, company_id: companyId, fetched: 0, inserted: 0, updated: 0 };
  }

  const mlOrderIds = allOrders.map((o: any) => Number(o.id));
  const { data: existingOrders } = await supabase
    .from("ml_orders")
    .select("id, ml_order_id")
    .eq("user_id", userId)
    .in("ml_order_id", mlOrderIds);
  const existingMap = new Map<number, string>();
  for (const eo of existingOrders ?? []) existingMap.set(Number(eo.ml_order_id), eo.id);

  const { data: products } = await supabase
    .from("products")
    .select("id, sku, id_ml")
    .eq("company_id", companyId);
  const productsByIdMl = new Map<string, string>();
  const productsBySku = new Map<string, string>();
  for (const p of products ?? []) {
    if (p.id_ml) productsByIdMl.set(normalizeText(p.id_ml), p.id);
    if (p.sku) productsBySku.set(normalizeText(p.sku), p.id);
  }

  let inserted = 0;
  let updated = 0;

  for (const order of allOrders) {
    const mlOid = Number(order.id);
    const shippingCost = order.payments?.reduce((s: number, p: any) => s + (p.shipping_cost ?? 0), 0) ?? 0;
    const marketplaceFee = order.payments?.reduce((s: number, p: any) => s + (p.marketplace_fee ?? 0), 0) ?? 0;

    const orderRow = {
      user_id: userId,
      company_id: companyId,
      ml_order_id: mlOid,
      ml_buyer_nickname: order.buyer?.nickname ?? null,
      ml_buyer_id: order.buyer?.id ? Number(order.buyer.id) : null,
      status: order.status ?? "unknown",
      total_amount: order.total_amount ?? 0,
      currency_id: order.currency_id ?? "BRL",
      shipping_cost: shippingCost,
      marketplace_fee: marketplaceFee,
      date_created: order.date_created ?? null,
      date_closed: order.date_closed ?? null,
      shipping_status: order.shipping?.status ?? null,
      shipping_id: order.shipping?.id ? Number(order.shipping.id) : null,
      pack_id: order.pack_id ? Number(order.pack_id) : null,
      ml_raw: order,
      updated_at: new Date().toISOString(),
    };

    let localOrderId = existingMap.get(mlOid);
    if (localOrderId) {
      await supabase.from("ml_orders").update(orderRow).eq("id", localOrderId);
      updated++;
    } else {
      const { data: ins } = await supabase
        .from("ml_orders")
        .insert(orderRow)
        .select("id")
        .maybeSingle();
      localOrderId = ins?.id;
      inserted++;
    }
    if (!localOrderId) continue;

    const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
    if (orderItems.length > 0) {
      await supabase.from("ml_order_items").delete().eq("ml_order_id", localOrderId);
      const itemRows = orderItems.map((oi: any) => {
        const itemId = String(oi.item?.id ?? "");
        const sellerSku = normalizeText(oi.item?.seller_sku || oi.item?.seller_custom_field);
        const productId =
          productsByIdMl.get(normalizeText(itemId)) ||
          (sellerSku ? productsBySku.get(sellerSku) : undefined) ||
          null;
        return {
          ml_order_id: localOrderId,
          ml_item_id: itemId,
          ml_item_title: oi.item?.title ?? null,
          quantity: oi.quantity ?? 1,
          unit_price: oi.unit_price ?? 0,
          total_price: (oi.unit_price ?? 0) * (oi.quantity ?? 1),
          sku: sellerSku || null,
          product_id: productId,
        };
      });
      await supabase.from("ml_order_items").insert(itemRows);
    }
  }

  return { user_id: userId, company_id: companyId, fetched: allOrders.length, inserted, updated, total_in_ml: totalInMl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: WEBHOOK_CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  const cronSecret = req.headers.get("x-cron-secret");
  let expectedCronSecret = Deno.env.get("CRON_SECRET") ?? null;
  if (cronSecret) {
    try {
      const svc = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } }
      );
      const { data: vaultSecret } = await svc.rpc("get_cron_secret");
      if (vaultSecret) expectedCronSecret = vaultSecret as unknown as string;
    } catch (_) {}
  }
  const hasCronAuth =
    !!expectedCronSecret && !!cronSecret && cronSecret === expectedCronSecret;

  let hasAdminAuth = false;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appId = Deno.env.get("MERCADO_LIVRE_APP_ID");
  const clientSecret = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET");

  if (!hasCronAuth && authHeader?.startsWith("Bearer ")) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (!claimsError && claimsData?.claims?.sub) {
      const adminClient = createClient(supabaseUrl, serviceKey);
      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", claimsData.claims.sub)
        .eq("role", "admin")
        .maybeSingle();
      hasAdminAuth = !!roleData;
    }
  }

  if (!hasCronAuth && !hasAdminAuth) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!appId || !clientSecret) {
    return json({ error: "ML credentials missing" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: connections, error: connErr } = await supabase
    .from("ml_connections")
    .select("*")
    .eq("is_active", true)
    .not("access_token", "is", null);

  if (connErr) {
    return json({ error: connErr.message }, 500);
  }

  const results: any[] = [];

  for (const conn of connections || []) {
    let token = conn.access_token;
    try {
      const refreshed = await refreshToken(supabase, conn, appId, clientSecret);
      if (refreshed) token = refreshed;
    } catch (e) {
      console.error(`[ml-orders-sync] refresh error user ${conn.user_id}:`, e);
    }
    if (!token) {
      results.push({ user_id: conn.user_id, status: "token_error" });
      continue;
    }

    try {
      const r = await syncOrdersForConnection(supabase, conn, token);
      results.push({ ...r, status: "ok" });
    } catch (e: any) {
      console.error(`[ml-orders-sync] sync error user ${conn.user_id}:`, e);
      results.push({ user_id: conn.user_id, status: "error", error: e?.message || String(e) });
    }
  }

  return json({ ok: true, results });
});
