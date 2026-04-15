// ML API Edge Function - v2
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ML_API_BASE = "https://api.mercadolibre.com";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const MAX_ITEMS_TO_SYNC = 1000;
const SEARCH_PAGE_SIZE = 100;
const DETAIL_BATCH_SIZE = 20;

class MlAuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MlAuthError";
    this.code = code;
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeText(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

function parsePositiveInt(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function extractSellerSku(item: any) {
  const rawCandidates = [
    item?.seller_custom_field,
    item?.seller_sku,
    ...(Array.isArray(item?.attributes)
      ? item.attributes
          .filter((attribute: any) =>
            ["SELLER_SKU", "SELLER_CUSTOM_FIELD"].includes(attribute?.id)
          )
          .flatMap((attribute: any) => [attribute?.value_name, attribute?.value_id])
      : []),
  ];

  return rawCandidates
    .map((candidate) => normalizeText(candidate))
    .find(Boolean) ?? null;
}

async function fetchMlJson(url: string, init: RequestInit, contextMessage: string) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || payload?.error || response.statusText;

    if ([400, 401, 403].includes(response.status)) {
      throw new MlAuthError(
        "reauth_required",
        "Sua conexão do Mercado Livre expirou ou precisa ser reconectada."
      );
    }

    throw new Error(`${contextMessage}: ${message}`);
  }

  return payload;
}

async function refreshToken(
  supabase: any,
  connection: any,
  appId: string,
  clientSecret: string
) {
  if (!connection.refresh_token) {
    throw new MlAuthError(
      "reauth_required",
      "Sua conexão do Mercado Livre precisa ser reconectada para atualizar os dados."
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: appId,
    client_secret: clientSecret,
    refresh_token: connection.refresh_token,
  });

  const response = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    console.error("ML refresh token error:", data);
    throw new MlAuthError(
      "reauth_required",
      "Não foi possível renovar a conexão do Mercado Livre. Reconecte sua conta para continuar."
    );
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  const { error } = await supabase
    .from("ml_connections")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? connection.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (error) {
    throw new Error("Não foi possível atualizar o token da integração.");
  }

  return data.access_token;
}

async function getConnection(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("ml_connections")
    .select("id, user_id, access_token, refresh_token, token_expires_at, is_active, ml_user_id, seller_nickname")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getValidToken(supabase: any, userId: string) {
  const connection = await getConnection(supabase, userId);

  if (!connection) {
    throw new MlAuthError(
      "not_connected",
      "Nenhuma conta do Mercado Livre está conectada."
    );
  }

  const appId = Deno.env.get("MERCADO_LIVRE_APP_ID");
  const clientSecret = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET");

  if (!appId || !clientSecret) {
    throw new Error("Credenciais do Mercado Livre não configuradas.");
  }

  const expiresAt = new Date(connection.token_expires_at).getTime();
  if (Number.isNaN(expiresAt)) {
    throw new MlAuthError(
      "reauth_required",
      "A conexão do Mercado Livre está inválida. Reconecte sua conta."
    );
  }

  if (expiresAt <= Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return await refreshToken(supabase, connection, appId, clientSecret);
  }

  return connection.access_token;
}

async function getSellerItems(mlUserId: string, mlHeaders: HeadersInit) {
  const allItemIds: string[] = [];
  let offset = 0;
  let total = 0;

  do {
    const page = await fetchMlJson(
      `${ML_API_BASE}/users/${mlUserId}/items/search?limit=${SEARCH_PAGE_SIZE}&offset=${offset}`,
      { headers: mlHeaders },
      "Erro ao buscar anúncios"
    );

    total = Number(page?.paging?.total ?? 0);
    const ids = Array.isArray(page?.results) ? page.results : [];
    allItemIds.push(...ids);

    if (ids.length === 0) {
      break;
    }

    offset += SEARCH_PAGE_SIZE;
  } while (offset < Math.min(total, MAX_ITEMS_TO_SYNC));

  if (allItemIds.length === 0) {
    return [];
  }

  const detailBatches: string[][] = [];
  for (let index = 0; index < allItemIds.length; index += DETAIL_BATCH_SIZE) {
    detailBatches.push(allItemIds.slice(index, index + DETAIL_BATCH_SIZE));
  }

  const detailResponses = await Promise.all(
    detailBatches.map(async (batch) => {
      const details = await fetchMlJson(
        `${ML_API_BASE}/items?ids=${batch.join(",")}`,
        { headers: mlHeaders },
        "Erro ao buscar detalhes dos anúncios"
      );

      return Array.isArray(details)
        ? details.map((entry: any) => entry?.body).filter(Boolean)
        : [];
    })
  );

  return detailResponses.flat();
}

async function syncCatalog(supabase: any, userId: string, accessToken: string) {
  const connection = await getConnection(supabase, userId);
  if (!connection) {
    throw new MlAuthError(
      "not_connected",
      "Nenhuma conta do Mercado Livre está conectada."
    );
  }

  const nowIso = new Date().toISOString();
  const mlHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const mlItems = await getSellerItems(connection.ml_user_id, mlHeaders);

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, sku, sku_ml, id_ml, name, stock_physical, stock_full");

  if (productsError) {
    throw productsError;
  }

  const { data: existingLinks, error: linksError } = await supabase
    .from("ml_linked_products")
    .select("id, ml_item_id, product_id")
    .eq("user_id", userId);

  if (linksError) {
    throw linksError;
  }

  const productsByIdMl = new Map<string, any>();
  const productsBySkuMl = new Map<string, any>();
  const productsBySku = new Map<string, any>();
  const productsById = new Map<string, any>();

  for (const product of products ?? []) {
    productsById.set(product.id, product);

    const normalizedIdMl = normalizeText(product.id_ml);
    const normalizedSkuMl = normalizeText(product.sku_ml);
    const normalizedSku = normalizeText(product.sku);

    if (normalizedIdMl) productsByIdMl.set(normalizedIdMl, product);
    if (normalizedSkuMl) productsBySkuMl.set(normalizedSkuMl, product);
    if (normalizedSku) productsBySku.set(normalizedSku, product);
  }

  const existingLinksByItemId = new Map<string, any>();
  for (const link of existingLinks ?? []) {
    existingLinksByItemId.set(link.ml_item_id, link);
  }

  const productUpdates = new Map<string, Record<string, string>>();
  const linksToInsert: any[] = [];
  const linksToUpdate: { id: string; values: Record<string, any> }[] = [];
  const seenItemIds = new Set<string>();
  let matchedProducts = 0;

  for (const item of mlItems) {
    const itemId = String(item.id);
    const normalizedItemId = normalizeText(itemId);
    const sellerSku = extractSellerSku(item);

    const matchedProduct =
      productsByIdMl.get(normalizedItemId) ||
      (sellerSku ? productsBySkuMl.get(sellerSku) : undefined) ||
      (sellerSku ? productsBySku.get(sellerSku) : undefined);

    if (!matchedProduct) {
      continue;
    }

    matchedProducts += 1;
    seenItemIds.add(itemId);

    const nextProductUpdate = productUpdates.get(matchedProduct.id) ?? {};
    if (!normalizeText(matchedProduct.id_ml)) {
      nextProductUpdate.id_ml = itemId;
    }
    if (sellerSku && !normalizeText(matchedProduct.sku_ml)) {
      nextProductUpdate.sku_ml = sellerSku;
    }
    if (Object.keys(nextProductUpdate).length > 0) {
      productUpdates.set(matchedProduct.id, nextProductUpdate);
    }

    const existingLink = existingLinksByItemId.get(itemId);
    const linkValues = {
      user_id: userId,
      product_id: matchedProduct.id,
      ml_item_id: itemId,
      ml_title: item.title ?? matchedProduct.name,
      ml_price: item.price ?? null,
      ml_available_quantity: item.available_quantity ?? null,
      ml_status: item.status ?? null,
      sync_status: "synced",
      last_synced_at: nowIso,
      updated_at: nowIso,
    };

    if (existingLink) {
      linksToUpdate.push({ id: existingLink.id, values: linkValues });
    } else {
      linksToInsert.push(linkValues);
    }
  }

  for (const [productId, values] of productUpdates.entries()) {
    const { error } = await supabase
      .from("products")
      .update(values)
      .eq("id", productId);

    if (error) {
      throw error;
    }
  }

  for (const link of linksToUpdate) {
    const { error } = await supabase
      .from("ml_linked_products")
      .update(link.values)
      .eq("id", link.id);

    if (error) {
      throw error;
    }
  }

  if (linksToInsert.length > 0) {
    const { error } = await supabase.from("ml_linked_products").insert(linksToInsert);
    if (error) {
      throw error;
    }
  }

  const staleLinkIds = (existingLinks ?? [])
    .filter((link) => !seenItemIds.has(link.ml_item_id))
    .map((link) => link.id);

  if (staleLinkIds.length > 0) {
    const { error } = await supabase
      .from("ml_linked_products")
      .delete()
      .in("id", staleLinkIds);

    if (error) {
      throw error;
    }
  }

  const matchedProductIds = new Set<string>();
  for (const link of [...linksToInsert, ...linksToUpdate.map((link) => link.values)]) {
    matchedProductIds.add(link.product_id);
  }

  return {
    total_items: mlItems.length,
    matched_products: matchedProducts,
    linked_products: matchedProductIds.size,
    unmatched_items: Math.max(mlItems.length - matchedProducts, 0),
    removed_links: staleLinkIds.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse({ error: "Backend configuration missing" }, 500);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = claimsData.claims.sub;
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Requisição inválida." }, 400);
    }

    const action = typeof body.action === "string" ? body.action : "";
    const params = typeof body.params === "object" && body.params !== null ? body.params : {};

    if (!action) {
      return jsonResponse({ error: "Ação inválida." }, 400);
    }

    if (action === "get-auth-url") {
      const appId = Deno.env.get("MERCADO_LIVRE_APP_ID");
      if (!appId) {
        return jsonResponse({ error: "Credenciais do Mercado Livre não configuradas." }, 500);
      }

      const redirectUri = `${supabaseUrl}/functions/v1/ml-oauth-callback`;
      const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&scope=${encodeURIComponent("offline_access read write")}&state=${encodeURIComponent(userId)}`;

      return jsonResponse({ url: authUrl });
    }

    if (action === "connection-status") {
      const connection = await getConnection(serviceClient, userId);
      if (!connection) {
        return jsonResponse(null);
      }

      const expiresAt = new Date(connection.token_expires_at).getTime();
      const tokenExpired = Number.isFinite(expiresAt) ? expiresAt <= Date.now() : true;

      // Auto-refresh token if expired but refresh_token is available
      if (tokenExpired && connection.refresh_token) {
        const appId = Deno.env.get("MERCADO_LIVRE_APP_ID");
        const clientSecret = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET");

        if (appId && clientSecret) {
          try {
            await refreshToken(serviceClient, connection, appId, clientSecret);
            // Re-fetch updated connection after refresh
            const updated = await getConnection(serviceClient, userId);
            if (updated) {
              return jsonResponse({
                seller_nickname: updated.seller_nickname,
                ml_user_id: updated.ml_user_id,
                token_expires_at: updated.token_expires_at,
                is_active: updated.is_active,
                has_refresh_token: Boolean(updated.refresh_token),
                needs_reauth: false,
              });
            }
          } catch (e) {
            console.error("Auto-refresh failed during status check:", e);
            // If refresh fails, fall through to needs_reauth
          }
        }
      }

      const needsReauth = tokenExpired && !connection.refresh_token;

      return jsonResponse({
        seller_nickname: connection.seller_nickname,
        ml_user_id: connection.ml_user_id,
        token_expires_at: connection.token_expires_at,
        is_active: connection.is_active,
        has_refresh_token: Boolean(connection.refresh_token),
        needs_reauth: needsReauth,
      });
    }

    if (action === "disconnect") {
      const connection = await getConnection(serviceClient, userId);
      if (!connection) {
        return jsonResponse({ success: true, message: "Nenhuma conexão ativa encontrada." });
      }

      // Delete linked products
      await serviceClient
        .from("ml_linked_products")
        .delete()
        .eq("user_id", userId);

      // Delete the connection
      const { error: deleteError } = await serviceClient
        .from("ml_connections")
        .delete()
        .eq("id", connection.id)
        .eq("user_id", userId);

      if (deleteError) {
        throw new Error("Erro ao desconectar conta do Mercado Livre.");
      }

      return jsonResponse({ success: true, message: "Conta desconectada com sucesso." });
    }

    const accessToken = await getValidToken(serviceClient, userId);
    const mlHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    switch (action) {
      case "get-items": {
        const connection = await getConnection(serviceClient, userId);
        if (!connection) {
          throw new MlAuthError("not_connected", "Nenhuma conta do Mercado Livre está conectada.");
        }

        const limit = parsePositiveInt(params.limit, 50, 100);
        const offset = parsePositiveInt(params.offset, 0, 1000);
        const itemsResponse = await fetchMlJson(
          `${ML_API_BASE}/users/${connection.ml_user_id}/items/search?limit=${limit}&offset=${offset}`,
          { headers: mlHeaders },
          "Erro ao buscar anúncios"
        );

        const idsList = Array.isArray(itemsResponse?.results) ? itemsResponse.results : [];
        const detailBatches: string[][] = [];
        for (let index = 0; index < idsList.length; index += DETAIL_BATCH_SIZE) {
          detailBatches.push(idsList.slice(index, index + DETAIL_BATCH_SIZE));
        }

        const itemDetails = await Promise.all(
          detailBatches.map(async (batch) => {
            const details = await fetchMlJson(
              `${ML_API_BASE}/items?ids=${batch.join(",")}`,
              { headers: mlHeaders },
              "Erro ao buscar detalhes dos anúncios"
            );

            return Array.isArray(details)
              ? details.map((entry: any) => entry?.body).filter(Boolean)
              : [];
          })
        );

        return jsonResponse({
          total: itemsResponse?.paging?.total ?? 0,
          items: itemDetails.flat(),
        });
      }

      case "get-orders": {
        const connection = await getConnection(serviceClient, userId);
        if (!connection) {
          throw new MlAuthError("not_connected", "Nenhuma conta do Mercado Livre está conectada.");
        }

        const sort = typeof params.sort === "string" ? params.sort : "date_desc";
        const limit = parsePositiveInt(params.limit, 20, 50);
        const offset = parsePositiveInt(params.offset, 0, 1000);
        const orders = await fetchMlJson(
          `${ML_API_BASE}/orders/search?seller=${connection.ml_user_id}&sort=${encodeURIComponent(
            sort
          )}&limit=${limit}&offset=${offset}`,
          { headers: mlHeaders },
          "Erro ao buscar pedidos"
        );

        return jsonResponse(orders);
      }

      case "get-item": {
        const itemId = typeof params.itemId === "string" ? params.itemId.trim() : "";
        if (!itemId || !/^MLB\d+$/i.test(itemId)) {
          return jsonResponse({ error: "ID do anúncio inválido. Use o formato MLB1234567890." }, 400);
        }

        const item = await fetchMlJson(
          `${ML_API_BASE}/items/${encodeURIComponent(itemId)}`,
          { headers: mlHeaders },
          "Erro ao buscar anúncio"
        );

        return jsonResponse(item);
      }

      case "get-item-description": {
        const itemId = typeof params.itemId === "string" ? params.itemId.trim() : "";
        if (!itemId || !/^MLB\d+$/i.test(itemId)) {
          return jsonResponse({ error: "ID do anúncio inválido." }, 400);
        }

        const desc = await fetchMlJson(
          `${ML_API_BASE}/items/${encodeURIComponent(itemId)}/description`,
          { headers: mlHeaders },
          "Erro ao buscar descrição"
        );

        return jsonResponse(desc);
      }

      case "sync-stock": {
        const itemId = typeof params.itemId === "string" ? params.itemId.trim() : "";
        const quantity = parsePositiveInt(params.quantity, 0, 999999);

        if (!itemId) {
          return jsonResponse({ error: "ID do anúncio inválido." }, 400);
        }

        const result = await fetchMlJson(
          `${ML_API_BASE}/items/${encodeURIComponent(itemId)}`,
          {
            method: "PUT",
            headers: mlHeaders,
            body: JSON.stringify({ available_quantity: quantity }),
          },
          "Erro ao sincronizar estoque"
        );

        await serviceClient
          .from("ml_linked_products")
          .update({
            last_synced_at: new Date().toISOString(),
            sync_status: "synced",
            ml_available_quantity: quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("ml_item_id", itemId)
          .eq("user_id", userId);

        return jsonResponse(result);
      }

      case "sync-price": {
        const itemId = typeof params.itemId === "string" ? params.itemId.trim() : "";
        const price = Number(params.price);

        if (!itemId) {
          return jsonResponse({ error: "ID do anúncio inválido." }, 400);
        }
        if (!Number.isFinite(price) || price < 0) {
          return jsonResponse({ error: "Preço inválido." }, 400);
        }

        const result = await fetchMlJson(
          `${ML_API_BASE}/items/${encodeURIComponent(itemId)}`,
          {
            method: "PUT",
            headers: mlHeaders,
            body: JSON.stringify({ price }),
          },
          "Erro ao sincronizar preço"
        );

        await serviceClient
          .from("ml_linked_products")
          .update({
            last_synced_at: new Date().toISOString(),
            sync_status: "synced",
            ml_price: price,
            updated_at: new Date().toISOString(),
          })
          .eq("ml_item_id", itemId)
          .eq("user_id", userId);

        return jsonResponse(result);
      }

      case "sync-all-to-ml": {
        // Check user sync preferences
        const { data: userSettings } = await serviceClient
          .from("ml_settings")
          .select("auto_sync_stock, auto_sync_price")
          .eq("user_id", userId)
          .maybeSingle();

        const shouldSyncStock = userSettings?.auto_sync_stock ?? true;
        const shouldSyncPrice = userSettings?.auto_sync_price ?? true;

        if (!shouldSyncStock && !shouldSyncPrice) {
          return jsonResponse({ synced: 0, errors: 0, total: 0, message: "Sincronização de estoque e preço desativada nas configurações." });
        }

        // Bidirectional bulk sync: push ERP price + stock to ALL linked ML items
        const { data: linkedProducts, error: lpError } = await serviceClient
          .from("ml_linked_products")
          .select("id, ml_item_id, product_id, products(stock_physical, stock_full, price)")
          .eq("user_id", userId);

        if (lpError) throw lpError;

        if (!linkedProducts?.length) {
          return jsonResponse({ synced: 0, errors: 0, message: "Nenhum produto vinculado." });
        }

        let synced = 0;
        let errors = 0;
        const errorDetails: string[] = [];

        for (const lp of linkedProducts) {
          const product = lp.products as any;
          if (!product) {
            errors++;
            continue;
          }

          const stockToSync = product.stock_full ?? product.stock_physical ?? 0;
          const priceToSync = product.price ?? 0;

          // Build update payload based on settings
          const updatePayload: Record<string, any> = {};
          if (shouldSyncStock) updatePayload.available_quantity = stockToSync;
          if (shouldSyncPrice) updatePayload.price = priceToSync;

          try {
            await fetchMlJson(
              `${ML_API_BASE}/items/${encodeURIComponent(lp.ml_item_id)}`,
              {
                method: "PUT",
                headers: mlHeaders,
                body: JSON.stringify(updatePayload),
              },
              `Erro ao sincronizar ${lp.ml_item_id}`
            );

            const linkUpdate: Record<string, any> = {
              last_synced_at: new Date().toISOString(),
              sync_status: "synced",
              updated_at: new Date().toISOString(),
            };
            if (shouldSyncStock) linkUpdate.ml_available_quantity = stockToSync;
            if (shouldSyncPrice) linkUpdate.ml_price = priceToSync;

            await serviceClient
              .from("ml_linked_products")
              .update(linkUpdate)
              .eq("id", lp.id);

            synced++;
          } catch (err: any) {
            errors++;
            errorDetails.push(`${lp.ml_item_id}: ${err.message}`);
          }
        }

        // Log the sync
        await serviceClient.from("ml_sync_logs").insert({
          user_id: userId,
          sync_type: "erp_to_ml_bulk",
          status: errors > 0 ? "partial" : "completed",
          items_synced: synced,
          finished_at: new Date().toISOString(),
          details: errorDetails.length ? errorDetails.join("; ") : null,
          error_message: errors > 0 ? `${errors} erro(s) ao sincronizar` : null,
        });

        return jsonResponse({ synced, errors, total: linkedProducts.length });
      }

      case "sync-catalog": {
        const result = await syncCatalog(serviceClient, userId, accessToken);
        return jsonResponse(result);
      }

      case "register-webhook": {
        const connection = await getConnection(serviceClient, userId);
        if (!connection) {
          throw new MlAuthError("not_connected", "Nenhuma conta do Mercado Livre está conectada.");
        }

        const appId = Deno.env.get("MERCADO_LIVRE_APP_ID");
        const webhookUrl = `${supabaseUrl}/functions/v1/ml-webhook`;

        // Register webhook with ML API for orders, items, and questions
        const topics = ["orders_v2", "items", "questions"];
        const results: any[] = [];

        for (const topic of topics) {
          try {
            const res = await fetch(`${ML_API_BASE}/applications/${appId}/webhooks`, {
              method: "POST",
              headers: mlHeaders,
              body: JSON.stringify({
                topic,
                callback_url: webhookUrl,
              }),
            });

            const data = await res.json().catch(() => null);
            results.push({ topic, status: res.status, data });
          } catch (err) {
            results.push({ topic, status: "error", error: String(err) });
          }
        }

        return jsonResponse({ webhook_url: webhookUrl, results });
      }

      case "webhook-status": {
        const appId = Deno.env.get("MERCADO_LIVRE_APP_ID");

        const res = await fetchMlJson(
          `${ML_API_BASE}/applications/${appId}/webhooks`,
          { headers: mlHeaders },
          "Erro ao consultar webhooks"
        );

        return jsonResponse(res);
      }

      case "unregister-webhook": {
        const appId = Deno.env.get("MERCADO_LIVRE_APP_ID");
        const webhookId = typeof params.webhookId === "string" ? params.webhookId.trim() : "";

        if (!webhookId) {
          return jsonResponse({ error: "ID do webhook inválido." }, 400);
        }

        const res = await fetch(`${ML_API_BASE}/applications/${appId}/webhooks/${encodeURIComponent(webhookId)}`, {
          method: "DELETE",
          headers: mlHeaders,
        });

        return jsonResponse({ deleted: res.ok, status: res.status });
      }

      case "sync-orders": {
        const connection = await getConnection(serviceClient, userId);
        if (!connection) {
          throw new MlAuthError("not_connected", "Nenhuma conta do Mercado Livre está conectada.");
        }

        // Get user's company_id
        const { data: memberData } = await serviceClient
          .from("company_members")
          .select("company_id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const companyId = memberData?.company_id ?? null;

        // Fetch orders from ML API (last 90 days, up to 200)
        const maxOrders = parsePositiveInt(params.limit, 200, 500);
        let allOrders: any[] = [];
        let orderOffset = 0;
        let totalOrders = 0;

        do {
          const page = await fetchMlJson(
            `${ML_API_BASE}/orders/search?seller=${connection.ml_user_id}&sort=date_desc&limit=50&offset=${orderOffset}`,
            { headers: mlHeaders },
            "Erro ao buscar pedidos"
          );
          totalOrders = Number(page?.paging?.total ?? 0);
          const results = Array.isArray(page?.results) ? page.results : [];
          allOrders.push(...results);
          if (!results.length) break;
          orderOffset += 50;
        } while (orderOffset < Math.min(totalOrders, maxOrders));

        // Get existing orders to detect updates vs inserts
        const mlOrderIds = allOrders.map((o: any) => Number(o.id));
        const { data: existingOrders } = await serviceClient
          .from("ml_orders")
          .select("id, ml_order_id")
          .eq("user_id", userId)
          .in("ml_order_id", mlOrderIds);

        const existingMap = new Map<number, string>();
        for (const eo of existingOrders ?? []) {
          existingMap.set(Number(eo.ml_order_id), eo.id);
        }

        // Get products for SKU matching
        const { data: products } = await serviceClient
          .from("products")
          .select("id, sku, id_ml");

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
            await serviceClient.from("ml_orders").update(orderRow).eq("id", localOrderId);
            updated++;
          } else {
            const { data: ins } = await serviceClient
              .from("ml_orders")
              .insert(orderRow)
              .select("id")
              .single();
            localOrderId = ins?.id;
            inserted++;
          }

          if (!localOrderId) continue;

          // Upsert order items
          const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
          if (orderItems.length > 0) {
            // Delete existing items for this order and re-insert
            await serviceClient.from("ml_order_items").delete().eq("ml_order_id", localOrderId);

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

            await serviceClient.from("ml_order_items").insert(itemRows);
          }
        }

        return jsonResponse({
          total_fetched: allOrders.length,
          inserted,
          updated,
          total_in_ml: totalOrders,
        });
      }

      case "get-questions": {
        const connection = await getConnection(serviceClient, userId);
        if (!connection) {
          throw new MlAuthError("not_connected", "Nenhuma conta do Mercado Livre está conectada.");
        }

        const limit = parsePositiveInt(params.limit, 50, 200);
        const offset = parsePositiveInt(params.offset, 0, 1000);

        const questionsRes = await fetchMlJson(
          `${ML_API_BASE}/questions/search?seller_id=${connection.ml_user_id}&sort_fields=date_created&sort_types=DESC&limit=${limit}&offset=${offset}`,
          { headers: mlHeaders },
          "Erro ao buscar perguntas"
        );

        return jsonResponse(questionsRes);
      }

      case "sync-questions": {
        const connection = await getConnection(serviceClient, userId);
        if (!connection) {
          throw new MlAuthError("not_connected", "Nenhuma conta do Mercado Livre está conectada.");
        }

        // Get company_id
        const { data: memberData } = await serviceClient
          .from("company_members")
          .select("company_id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const companyId = memberData?.company_id ?? null;

        // Fetch recent questions from ML
        const maxQuestions = parsePositiveInt(params.limit, 100, 500);
        let allQuestions: any[] = [];
        let qOffset = 0;
        let totalQuestions = 0;

        do {
          const page = await fetchMlJson(
            `${ML_API_BASE}/questions/search?seller_id=${connection.ml_user_id}&sort_fields=date_created&sort_types=DESC&limit=50&offset=${qOffset}`,
            { headers: mlHeaders },
            "Erro ao buscar perguntas"
          );
          totalQuestions = Number(page?.total ?? 0);
          const results = Array.isArray(page?.questions) ? page.questions : [];
          allQuestions.push(...results);
          if (!results.length) break;
          qOffset += 50;
        } while (qOffset < Math.min(totalQuestions, maxQuestions));

        // Get existing questions
        const mlQIds = allQuestions.map((q: any) => Number(q.id));
        const { data: existingQs } = await serviceClient
          .from("ml_questions")
          .select("id, ml_question_id")
          .eq("user_id", userId)
          .in("ml_question_id", mlQIds);

        const existingQMap = new Map<number, string>();
        for (const eq of existingQs ?? []) {
          existingQMap.set(Number(eq.ml_question_id), eq.id);
        }

        // Batch fetch item titles
        const uniqueItemIds = [...new Set(allQuestions.map((q: any) => String(q.item_id)).filter(Boolean))];
        const itemTitles = new Map<string, string>();
        
        for (let i = 0; i < uniqueItemIds.length; i += DETAIL_BATCH_SIZE) {
          const batch = uniqueItemIds.slice(i, i + DETAIL_BATCH_SIZE);
          try {
            const details = await fetchMlJson(
              `${ML_API_BASE}/items?ids=${batch.join(",")}&attributes=id,title`,
              { headers: mlHeaders },
              "Erro ao buscar títulos"
            );
            if (Array.isArray(details)) {
              for (const d of details) {
                if (d?.body?.id) itemTitles.set(String(d.body.id), d.body.title ?? "");
              }
            }
          } catch { /* continue */ }
        }

        let inserted = 0;
        let updated = 0;

        for (const q of allQuestions) {
          const mlQid = Number(q.id);
          const row = {
            user_id: userId,
            company_id: companyId,
            ml_question_id: mlQid,
            ml_item_id: String(q.item_id ?? ""),
            ml_item_title: itemTitles.get(String(q.item_id)) ?? null,
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

          const existingId = existingQMap.get(mlQid);
          if (existingId) {
            await serviceClient.from("ml_questions").update(row).eq("id", existingId);
            updated++;
          } else {
            await serviceClient.from("ml_questions").insert(row);
            inserted++;
          }
        }

        return jsonResponse({
          total_fetched: allQuestions.length,
          inserted,
          updated,
          total_in_ml: totalQuestions,
        });
      }

      case "suggest-answer": {
        const questionText = typeof params.questionText === "string" ? params.questionText.trim() : "";
        const itemTitle = typeof params.itemTitle === "string" ? params.itemTitle.trim() : "";
        const itemId = typeof params.itemId === "string" ? params.itemId.trim() : "";

        if (!questionText) {
          return jsonResponse({ error: "Texto da pergunta é obrigatório." }, 400);
        }

        // Fetch product info from catalog if we have itemId
        let productContext = "";
        if (itemId) {
          const { data: linkedProduct } = await serviceClient
            .from("ml_linked_products")
            .select("product_id, products(name, description, price, stock_physical, stock_full, barcode, sku)")
            .eq("ml_item_id", itemId)
            .eq("user_id", userId)
            .maybeSingle();

          if (linkedProduct?.products) {
            const p = linkedProduct.products as any;
            const stockInfo = p.stock_full ?? p.stock_physical ?? 0;
            productContext = `\n\nInformações do produto no catálogo:\n- Nome: ${p.name}\n- Descrição: ${p.description || "N/A"}\n- Preço: R$ ${p.price?.toFixed(2) || "N/A"}\n- Estoque disponível: ${stockInfo} unidades\n- SKU: ${p.sku || "N/A"}`;
          }
        }

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) {
          return jsonResponse({ error: "Chave de IA não configurada." }, 500);
        }

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Você é um assistente de vendas do Mercado Livre. Gere uma resposta profissional, educada e objetiva para a pergunta de um comprador. A resposta deve:
- Ser em português brasileiro
- Ter no máximo 350 caracteres (limite do Mercado Livre)
- Ser direta e útil
- Não incluir links ou informações de contato externo
- Não prometer prazos de entrega específicos (diga "conforme prazo informado no anúncio")
- Agradecer ao comprador quando apropriado
- Se não tiver informação suficiente, diga que pode ajudar com mais detalhes`,
              },
              {
                role: "user",
                content: `Anúncio: ${itemTitle || "Produto"}${productContext}\n\nPergunta do comprador: "${questionText}"\n\nGere uma resposta adequada:`,
              },
            ],
          }),
        });

        if (!aiResponse.ok) {
          if (aiResponse.status === 429) {
            return jsonResponse({ error: "Limite de requisições de IA excedido. Tente novamente em instantes." }, 429);
          }
          if (aiResponse.status === 402) {
            return jsonResponse({ error: "Créditos de IA esgotados. Adicione créditos na sua conta." }, 402);
          }
          return jsonResponse({ error: "Erro ao gerar sugestão de IA." }, 500);
        }

        const aiData = await aiResponse.json();
        const suggestion = aiData?.choices?.[0]?.message?.content?.trim() ?? "";

        return jsonResponse({ suggestion });
      }

      case "answer-question": {
        const questionId = typeof params.questionId === "number" || typeof params.questionId === "string"
          ? Number(params.questionId) : 0;
        const answerText = typeof params.text === "string" ? params.text.trim() : "";

        if (!questionId) {
          return jsonResponse({ error: "ID da pergunta inválido." }, 400);
        }
        if (!answerText || answerText.length > 2000) {
          return jsonResponse({ error: "Resposta inválida (1-2000 caracteres)." }, 400);
        }

        const result = await fetchMlJson(
          `${ML_API_BASE}/answers`,
          {
            method: "POST",
            headers: mlHeaders,
            body: JSON.stringify({
              question_id: questionId,
              text: answerText,
            }),
          },
          "Erro ao responder pergunta"
        );

        // Update local record
        await serviceClient
          .from("ml_questions")
          .update({
            answer_text: answerText,
            answer_date: new Date().toISOString(),
            status: "answered",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("ml_question_id", questionId);

        return jsonResponse(result);
      }

      case "duplicate-item": {
        const sourceItemId = typeof params.itemId === "string" ? params.itemId.trim() : "";
        if (!sourceItemId) {
          return jsonResponse({ error: "ID do anúncio de origem é obrigatório." }, 400);
        }

        const itemBody = params.item;
        if (!itemBody || typeof itemBody !== "object") {
          return jsonResponse({ error: "Dados do anúncio são obrigatórios." }, 400);
        }

        // Validate required fields
        if (!itemBody.title || typeof itemBody.title !== "string" || itemBody.title.length < 1 || itemBody.title.length > 60) {
          return jsonResponse({ error: "Título inválido (1-60 caracteres)." }, 400);
        }
        if (!itemBody.category_id || typeof itemBody.category_id !== "string") {
          return jsonResponse({ error: "Categoria é obrigatória." }, 400);
        }
        if (!Number.isFinite(itemBody.price) || itemBody.price <= 0) {
          return jsonResponse({ error: "Preço inválido." }, 400);
        }

        // Build the new item payload
        const newItem: Record<string, any> = {
          title: itemBody.title,
          category_id: itemBody.category_id,
          price: itemBody.price,
          currency_id: itemBody.currency_id || "BRL",
          buying_mode: itemBody.buying_mode || "buy_it_now",
          condition: itemBody.condition || "new",
          listing_type_id: itemBody.listing_type_id || "gold_special",
          available_quantity: itemBody.available_quantity ?? 1,
        };

        if (itemBody.description) {
          newItem.description = { plain_text: itemBody.description };
        }
        if (Array.isArray(itemBody.pictures) && itemBody.pictures.length > 0) {
          newItem.pictures = itemBody.pictures;
        }
        if (Array.isArray(itemBody.attributes)) {
          newItem.attributes = itemBody.attributes;
        }
        if (Array.isArray(itemBody.variations) && itemBody.variations.length > 0) {
          newItem.variations = itemBody.variations;
          // When using variations, remove top-level available_quantity
          delete newItem.available_quantity;
        }

        const createdItem = await fetchMlJson(
          `${ML_API_BASE}/items`,
          {
            method: "POST",
            headers: mlHeaders,
            body: JSON.stringify(newItem),
          },
          "Erro ao criar anúncio duplicado"
        );

        return jsonResponse(createdItem);
      }

      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (error) {
    if (error instanceof MlAuthError) {
      return jsonResponse({ error: error.message, code: error.code }, 401);
    }

    console.error("ML API error:", error);
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao processar a integração do Mercado Livre.",
      },
      500
    );
  }
});
