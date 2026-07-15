// Edge Function: ml-returns-sync
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ML_API_BASE = "https://api.mercadolibre.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const { data: userRes } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  const user = userRes?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  const companyId = profile?.company_id;
  if (!companyId) {
    return new Response(JSON.stringify({ error: "Empresa não vinculada" }), { status: 400, headers: corsHeaders });
  }

  const { data: conn } = await supabase
    .from("ml_connections")
    .select("access_token, ml_user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conn?.access_token) {
    return new Response(JSON.stringify({ error: "ML não conectado" }), { status: 400, headers: corsHeaders });
  }

  const token = conn.access_token;
  const sellerId = conn.ml_user_id;
  const headers = { Authorization: `Bearer ${token}` };

  const summary = { fetched: 0, inserted: 0, updated: 0, skipped: 0, errors: [] as any[] };

  try {
    // Buscar devoluções (type=return): abertas + fechadas
    const claims: any[] = [];
    for (const status of ["opened", "closed"]) {
      let offset = 0;
      while (true) {
        const url = `${ML_API_BASE}/post-purchase/v1/claims/search?seller_id=${sellerId}&type=return&status=${status}&limit=100&offset=${offset}`;
        const r = await fetch(url, { headers });
        if (!r.ok) {
          summary.errors.push({ url, status: r.status, body: await r.text() });
          break;
        }
        const j = await r.json();
        const data = j?.data ?? [];
        claims.push(...data);
        const total = j?.paging?.total ?? 0;
        offset += data.length || 100;
        if (offset >= total || data.length === 0) break;
        if (offset >= 1000) break; // safety cap por status
      }
    }
    summary.fetched = claims.length;

    for (const claim of claims) {
      try {
        const externalId = String(claim.id);
        // Buscar ordem relacionada se resource=order
        let orderId: string | null = null;
        let orderData: any = null;
        if (claim.resource === "order" && claim.resource_id) {
          orderId = String(claim.resource_id);
          const orderRes = await fetch(`${ML_API_BASE}/orders/${orderId}`, { headers });
          if (orderRes.ok) orderData = await orderRes.json();
        }

        const buyerName = orderData?.buyer
          ? [orderData.buyer.first_name, orderData.buyer.last_name].filter(Boolean).join(" ").trim() || orderData.buyer.nickname
          : null;
        const valorTotal = orderData?.total_amount ?? null;
        const statusMap: Record<string, string> = {
          opened: "pendente",
          closed: "concluida",
        };
        const returnStatus = statusMap[claim.status] ?? "pendente";

        const payload: any = {
          company_id: companyId,
          source: "mercado_livre",
          external_id: externalId,
          numero: orderId ?? externalId,
          order_reference: orderId,
          customer_name: buyerName,
          motivo: claim.reason_id ?? null,
          valor_total: valorTotal,
          status: returnStatus,
          received_at: claim.date_created ?? null,
          concluded_at: claim.status === "closed" ? (claim.last_updated ?? null) : null,
          created_by: user.id,
        };

        // upsert por (company_id, external_id, source)
        const { data: existing } = await supabase
          .from("returns")
          .select("id")
          .eq("company_id", companyId)
          .eq("source", "mercado_livre")
          .eq("external_id", externalId)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase.from("returns").update(payload).eq("id", existing.id);
          if (error) throw error;
          summary.updated++;
        } else {
          const { error } = await supabase.from("returns").insert(payload);
          if (error) throw error;
          summary.inserted++;
        }
      } catch (e: any) {
        summary.errors.push({ claim_id: claim?.id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, ...summary }), { headers: corsHeaders });
  } catch (err: any) {
    console.error("ml-returns-sync error", err);
    return new Response(JSON.stringify({ error: err.message, ...summary }), { status: 500, headers: corsHeaders });
  }
});
