import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function refreshToken(
  supabase: any,
  connection: any,
  appId: string,
  clientSecret: string
) {
  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: appId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await supabase
    .from("ml_connections")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  return data.access_token;
}

async function getValidToken(supabase: any, userId: string) {
  const { data: conn, error } = await supabase
    .from("ml_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (error || !conn) throw new Error("No ML connection found");

  const APP_ID = Deno.env.get("MERCADO_LIVRE_APP_ID")!;
  const CLIENT_SECRET = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET")!;

  // Refresh if expired or about to expire (5 min buffer)
  if (new Date(conn.token_expires_at) <= new Date(Date.now() + 5 * 60 * 1000)) {
    return await refreshToken(supabase, conn, APP_ID, CLIENT_SECRET);
  }

  return conn.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const { action, params } = body;

    const accessToken = await getValidToken(serviceClient, userId);

    const mlHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    let result: any;

    switch (action) {
      case "get-items": {
        // Get seller's items
        const { data: conn } = await serviceClient
          .from("ml_connections")
          .select("ml_user_id")
          .eq("user_id", userId)
          .single();

        const itemsRes = await fetch(
          `https://api.mercadolibre.com/users/${conn.ml_user_id}/items/search?limit=${params?.limit || 50}&offset=${params?.offset || 0}`,
          { headers: mlHeaders }
        );
        const itemsData = await itemsRes.json();

        if (itemsData.results?.length > 0) {
          const ids = itemsData.results.join(",");
          const detailsRes = await fetch(
            `https://api.mercadolibre.com/items?ids=${ids}`,
            { headers: mlHeaders }
          );
          const detailsData = await detailsRes.json();
          result = {
            total: itemsData.paging?.total || 0,
            items: detailsData.map((d: any) => d.body),
          };
        } else {
          result = { total: 0, items: [] };
        }
        break;
      }

      case "get-orders": {
        const { data: conn } = await serviceClient
          .from("ml_connections")
          .select("ml_user_id")
          .eq("user_id", userId)
          .single();

        const sort = params?.sort || "date_desc";
        const limit = params?.limit || 50;
        const offset = params?.offset || 0;
        const ordersRes = await fetch(
          `https://api.mercadolibre.com/orders/search?seller=${conn.ml_user_id}&sort=${sort}&limit=${limit}&offset=${offset}`,
          { headers: mlHeaders }
        );
        result = await ordersRes.json();
        break;
      }

      case "get-item": {
        const res = await fetch(
          `https://api.mercadolibre.com/items/${params.itemId}`,
          { headers: mlHeaders }
        );
        result = await res.json();
        break;
      }

      case "sync-stock": {
        // Update ML item stock from local product
        const res = await fetch(
          `https://api.mercadolibre.com/items/${params.itemId}`,
          {
            method: "PUT",
            headers: mlHeaders,
            body: JSON.stringify({
              available_quantity: params.quantity,
            }),
          }
        );
        result = await res.json();

        // Update sync status in db
        await serviceClient
          .from("ml_linked_products")
          .update({
            last_synced_at: new Date().toISOString(),
            sync_status: "synced",
            ml_available_quantity: params.quantity,
          })
          .eq("ml_item_id", params.itemId)
          .eq("user_id", userId);

        break;
      }

      case "connection-status": {
        const { data: conn } = await serviceClient
          .from("ml_connections")
          .select("seller_nickname, ml_user_id, token_expires_at, is_active")
          .eq("user_id", userId)
          .single();

        result = conn || null;
        break;
      }

      case "get-auth-url": {
        const APP_ID = Deno.env.get("MERCADO_LIVRE_APP_ID")!;
        const SUPABASE_URL_VAL = Deno.env.get("SUPABASE_URL")!;
        const redirectUri = `${SUPABASE_URL_VAL}/functions/v1/ml-oauth-callback`;
        const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;
        result = { url: authUrl };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ML API error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
