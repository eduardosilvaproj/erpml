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
      const authUrl = `${ML_API_BASE.replace("api.", "auth.")}/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(
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
        if (!itemId) {
          return jsonResponse({ error: "ID do anúncio inválido." }, 400);
        }

        const item = await fetchMlJson(
          `${ML_API_BASE}/items/${encodeURIComponent(itemId)}`,
          { headers: mlHeaders },
          "Erro ao buscar anúncio"
        );

        return jsonResponse(item);
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

      case "sync-catalog": {
        const result = await syncCatalog(serviceClient, userId, accessToken);
        return jsonResponse(result);
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
