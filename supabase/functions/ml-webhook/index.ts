// ML Webhook Edge Function - receives real-time notifications from Mercado Livre
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { WEBHOOK_CORS_HEADERS } from "../_shared/cors.ts";

const ML_API_BASE = "https://api.mercadolibre.com";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...WEBHOOK_CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function normalizeText(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

async function refreshTokenIfNeeded(
  supabase: any,
  connection: any
) {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    console.error(`Connection ${connection.id} needs reauth - no refresh_token`);
    await supabase
      .from("ml_connections")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", connection.id);
    return null;
  }

  const appId = Deno.env.get("MERCADO_LIVRE_APP_ID");
  const clientSecret = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET");
  if (!appId || !clientSecret) {
    const missing = [!appId && "MERCADO_LIVRE_APP_ID", !clientSecret && "MERCADO_LIVRE_CLIENT_SECRET"].filter(Boolean).join(", ");
    console.error(`[ml-webhook] Refresh abortado — secrets faltando: ${missing}`);
    return null;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: appId,
    client_secret: clientSecret,
    refresh_token: connection.refresh_token,
  });

  const response = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    console.error("Webhook refresh token failed:", data);
    await supabase
      .from("ml_connections")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", connection.id);
    return null;
  }

  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase
    .from("ml_connections")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? connection.refresh_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return data.access_token;
}

async function handleOrderNotification(
  supabase: any,
  connection: any,
  accessToken: string,
  resourcePath: string
) {
  // Fetch order details from ML
  const response = await fetch(`${ML_API_BASE}${resourcePath}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });

  if (!response.ok) {
    console.error(`Failed to fetch order ${resourcePath}:`, response.status);
    return;
  }

  const order = await response.json();
  const mlOid = Number(order.id);
  const userId = connection.user_id;

  // Get company_id
  const { data: memberData } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const companyId = memberData?.company_id ?? null;

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

  // Check if order exists
  const { data: existing } = await supabase
    .from("ml_orders")
    .select("id")
    .eq("user_id", userId)
    .eq("ml_order_id", mlOid)
    .maybeSingle();

  let localOrderId: string;

  if (existing) {
    await supabase.from("ml_orders").update(orderRow).eq("id", existing.id);
    localOrderId = existing.id;
  } else {
    const { data: ins } = await supabase
      .from("ml_orders")
      .insert(orderRow)
      .select("id")
      .maybeSingle();
    if (!ins?.id) return;
    localOrderId = ins.id;
  }

  // Upsert order items
  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  if (orderItems.length > 0) {
    // Get products for SKU matching
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

    await supabase.from("ml_order_items").delete().eq("ml_order_id", localOrderId);

    const itemRows = orderItems.map((oi: any) => {
      const itemId = String(oi.item?.id ?? "");
      const sellerSku = normalizeText(oi.item?.seller_sku || oi.item?.seller_custom_field);
      const productId = productsByIdMl.get(normalizeText(itemId))
        || (sellerSku ? productsBySku.get(sellerSku) : undefined)
        || null;

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

  console.log(`Order ${mlOid} ${existing ? "updated" : "inserted"} via webhook`);
}

async function handleItemNotification(
  supabase: any,
  connection: any,
  accessToken: string,
  resourcePath: string
) {
  // Fetch item details
  const itemId = resourcePath.split("/").pop();
  if (!itemId) return;

  const response = await fetch(`${ML_API_BASE}${resourcePath}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error(`Failed to fetch item ${resourcePath}:`, response.status);
    return;
  }

  const item = await response.json();
  const userId = connection.user_id;

  // Update ml_linked_products if this item is linked
  const { data: link } = await supabase
    .from("ml_linked_products")
    .select("id, product_id")
    .eq("user_id", userId)
    .eq("ml_item_id", String(item.id))
    .maybeSingle();

  if (link) {
    const mlPrice = item.price ?? null;
    const mlOriginalPrice = item.original_price ?? null;

    await supabase
      .from("ml_linked_products")
      .update({
        ml_title: item.title ?? null,
        ml_price: mlPrice,
        ml_original_price: mlOriginalPrice,
        ml_available_quantity: item.available_quantity ?? null,
        ml_status: item.status ?? null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);

    // Sync products.price with the ML price
    if (mlPrice !== null && link.product_id) {
      await supabase
        .from("products")
        .update({ price: mlPrice, updated_at: new Date().toISOString() })
        .eq("id", link.product_id);
    }

    console.log(`Linked product ${item.id} updated via webhook`);
  }
}

async function handlePriceNotification(
  supabase: any,
  connection: any,
  accessToken: string,
  resourcePath: string
) {
  // items_price notifications: resource is like /items/MLB1234567890
  const itemId = resourcePath.split("/").pop();
  if (!itemId) return;

  const response = await fetch(`${ML_API_BASE}/items/${itemId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error(`Failed to fetch item price ${resourcePath}:`, response.status);
    return;
  }

  const item = await response.json();
  const userId = connection.user_id;

  const { data: link } = await supabase
    .from("ml_linked_products")
    .select("id, product_id")
    .eq("user_id", userId)
    .eq("ml_item_id", String(item.id))
    .maybeSingle();

  if (link) {
    const mlPrice = item.price ?? null;
    const mlOriginalPrice = item.original_price ?? null;

    await supabase
      .from("ml_linked_products")
      .update({
        ml_price: mlPrice,
        ml_original_price: mlOriginalPrice,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", link.id);

    // Sync products.price with the ML price
    if (mlPrice !== null && link.product_id) {
      await supabase
        .from("products")
        .update({ price: mlPrice, updated_at: new Date().toISOString() })
        .eq("id", link.product_id);
    }

    console.log(`Price updated for linked product ${item.id} via webhook`);
  }
}

async function handleQuestionNotification(
  supabase: any,
  connection: any,
  accessToken: string,
  resourcePath: string
) {
  // resourcePath is like /questions/123456
  const questionId = resourcePath.split("/").pop();
  if (!questionId) return;

  const response = await fetch(`${ML_API_BASE}${resourcePath}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error(`Failed to fetch question ${resourcePath}:`, response.status);
    return;
  }

  const q = await response.json();
  const userId = connection.user_id;

  // Get company_id
  const { data: memberData } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const companyId = memberData?.company_id ?? null;

  const questionRow = {
    user_id: userId,
    company_id: companyId,
    ml_question_id: Number(q.id),
    ml_item_id: String(q.item_id ?? ""),
    ml_from_id: q.from?.id ? Number(q.from.id) : null,
    ml_from_nickname: q.from?.nickname ?? null,
    question_text: q.text ?? "",
    answer_text: q.answer?.text ?? null,
    question_date: q.date_created ?? null,
    answer_date: q.answer?.date_created ?? null,
    status: q.status ?? (q.answer ? "answered" : "unanswered"),
    ml_raw: q,
    updated_at: new Date().toISOString(),
  };

  // Fetch item title
  try {
    const itemRes = await fetch(`${ML_API_BASE}/items/${q.item_id}?attributes=title`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (itemRes.ok) {
      const item = await itemRes.json();
      questionRow.ml_item_title = item.title ?? null;
    }
  } catch { /* ignore */ }

  // Check if exists
  const { data: existing } = await supabase
    .from("ml_questions")
    .select("id")
    .eq("user_id", userId)
    .eq("ml_question_id", Number(q.id))
    .maybeSingle();

  if (existing) {
    await supabase.from("ml_questions").update(questionRow).eq("id", existing.id);
  } else {
    await supabase.from("ml_questions").insert(questionRow);
  }

  console.log(`Question ${q.id} ${existing ? "updated" : "inserted"} via webhook`);
}

async function getUserSettings(supabase: any, userId: string) {
  const { data } = await supabase
    .from("ml_settings")
    .select("auto_sync_stock, auto_sync_price, auto_sync_orders, auto_suggest_answers")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    auto_sync_stock: data?.auto_sync_stock ?? true,
    auto_sync_price: data?.auto_sync_price ?? true,
    auto_sync_orders: data?.auto_sync_orders ?? true,
    auto_suggest_answers: data?.auto_suggest_answers ?? false,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: WEBHOOK_CORS_HEADERS });
  }

  // ML sends POST notifications
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: "Backend configuration missing" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Invalid notification" }, 400);
    }

    const { resource, topic, user_id: mlUserId, application_id } = body;

    // Validate required fields
    if (!resource || !topic) {
      return jsonResponse({ error: "Missing resource or topic" }, 400);
    }

    // Validate application_id matches our app
    const appId = Deno.env.get("MERCADO_LIVRE_APP_ID");
    if (appId && application_id && String(application_id) !== String(appId)) {
      console.warn(`Webhook received for different app: ${application_id} vs ${appId}`);
      return jsonResponse({ status: "ignored" });
    }

    // Find the connection by ml_user_id
    const { data: connection, error: connError } = await supabase
      .from("ml_connections")
      .select("id, user_id, access_token, refresh_token, token_expires_at, is_active, ml_user_id")
      .eq("ml_user_id", String(mlUserId))
      .eq("is_active", true)
      .maybeSingle();

    if (connError || !connection) {
      console.warn(`No active connection for ML user ${mlUserId}`);
      return jsonResponse({ status: "no_connection" });
    }

    // Check user preferences before processing
    const settings = await getUserSettings(supabase, connection.user_id);

    // Skip processing if user has disabled this type
    if (
      ((topic === "orders_v2" || topic === "orders") && !settings.auto_sync_orders) ||
      (topic === "items" && !settings.auto_sync_stock) ||
      (topic === "items_price" && !settings.auto_sync_price) ||
      (topic === "questions" && !settings.auto_sync_orders)
    ) {
      console.log(`Webhook ${topic} skipped for user ${connection.user_id} — disabled in settings`);
      return jsonResponse({ status: "skipped_by_settings" });
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(supabase, connection);
    if (!accessToken) {
      console.error(`Could not get valid token for user ${connection.user_id}`);
      return jsonResponse({ status: "token_error" });
    }

    // Log the notification
    await supabase.from("ml_sync_logs").insert({
      user_id: connection.user_id,
      sync_type: `webhook_${topic}`,
      status: "started",
      details: JSON.stringify({ resource, topic, ml_user_id: mlUserId }),
    });

    // Process based on topic
    switch (topic) {
      case "orders_v2":
      case "orders": {
        await handleOrderNotification(supabase, connection, accessToken, resource);
        break;
      }

      case "items": {
        await handleItemNotification(supabase, connection, accessToken, resource);
        break;
      }

      case "items_price": {
        await handlePriceNotification(supabase, connection, accessToken, resource);
        break;
      }

      case "questions": {
        await handleQuestionNotification(supabase, connection, accessToken, resource);
        break;
      }

      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    // Update sync log
    await supabase
      .from("ml_sync_logs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        items_synced: 1,
      })
      .eq("user_id", connection.user_id)
      .eq("sync_type", `webhook_${topic}`)
      .eq("status", "started")
      .order("created_at", { ascending: false })
      .limit(1);

    return jsonResponse({ status: "ok" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return jsonResponse({ status: "error" }, 200); // ML expects 200 to not retry excessively
  }
});
