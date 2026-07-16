// Edge Function: ml-returns-sync — MODO DIAGNÓSTICO PROFUNDO
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ML_API_BASE = "https://api.mercadolibre.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { data: userRes } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  const user = userRes?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { data: conns } = await supabase
    .from("ml_connections")
    .select("access_token, ml_user_id, seller_nickname")
    .eq("is_active", true);

  if (!conns || conns.length === 0) {
    return new Response(JSON.stringify({ error: "Nenhuma conexão ML ativa" }), { status: 400, headers: corsHeaders });
  }

  const testOrderIds = ["2000013952898453", "2000013948843163"];
  const diagnostics: any[] = [];

  for (const conn of conns) {
    const token = conn.access_token;
    const sellerId = conn.ml_user_id;
    const sellerDiag: any = { seller_id: sellerId, nickname: conn.seller_nickname, orders: [] };

    for (const orderId of testOrderIds) {
      const orderDiag: any = { order_id: orderId };

      try {
        const r1 = await fetch(`${ML_API_BASE}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r1.status === 200) {
          const body = await r1.json();
          orderDiag.order_status = body.status;
          orderDiag.order_tags = body.tags;
          orderDiag.pack_id = body.pack_id;
        } else {
          orderDiag.order_fetch = `status ${r1.status}`;
        }
      } catch (e: any) { orderDiag.order_fetch_error = e.message; }

      try {
        const r2 = await fetch(`${ML_API_BASE}/post-purchase/v1/claims/search?seller_id=${sellerId}&resource=order&resource_id=${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r2.status === 200) {
          const body = await r2.json();
          const claims = body.data || body.results || [];
          orderDiag.claims_found = claims.length;
          orderDiag.claims = claims.map((c: any) => ({
            id: c.id,
            status: c.status,
            stage: c.stage,
            type: c.type,
            return_id: c.return_id,
            resolution: c.resolution
          }));

          for (const c of claims) {
            if (c.return_id || c.id) {
              try {
                const r3 = await fetch(`${ML_API_BASE}/post-purchase/v2/claims/${c.id}/returns`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (r3.status === 200) {
                  orderDiag.return_details = await r3.json();
                } else {
                  orderDiag.return_details_fetch = `status ${r3.status}`;
                }
              } catch (e: any) { orderDiag.return_details_error = e.message; }
            }
          }
        } else {
          orderDiag.claims_search = `status ${r2.status}`;
        }
      } catch (e: any) { orderDiag.claims_search_error = e.message; }

      sellerDiag.orders.push(orderDiag);
    }
    diagnostics.push(sellerDiag);
  }

  return new Response(JSON.stringify({ diagnostic_deep: true, results: diagnostics }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
