// Edge Function: ml-returns-sync — Produção
// Sincroniza devoluções FÍSICAS ABERTAS/EM TRÂNSITO do Mercado Livre
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ML_API_BASE = "https://api.mercadolibre.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const OPEN_RETURN_STATUSES = new Set([
  "pending",
  "shipped",
  "in_transit",
  "to_be_agreed",
  "opened",
  "ready_to_ship",
]);

const CLOSED_RETURN_STATUSES = new Set([
  "delivered",
  "closed",
  "cancelled",
  "canceled",
  "failed",
  "return_to_buyer",
  "expired",
  "not_delivered",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isOpenPhysicalReturn(returnData: any): { open: boolean; status: string | null; hasPhysical: boolean } {
  if (!returnData || typeof returnData !== "object") {
    return { open: false, status: null, hasPhysical: false };
  }

  // A API pode devolver um objeto único ou {data:[...]} / {results:[...]}
  const candidates: any[] = [];
  if (Array.isArray(returnData)) candidates.push(...returnData);
  else if (Array.isArray(returnData.data)) candidates.push(...returnData.data);
  else if (Array.isArray(returnData.results)) candidates.push(...returnData.results);
  else candidates.push(returnData);

  for (const r of candidates) {
    if (!r) continue;
    const status = String(
      r.status ??
      r.shipping?.status ??
      r.subtype ??
      ""
    ).toLowerCase();

    // Sinais de retorno físico: existe shipping/tracking/id de retorno
    const hasPhysical =
      !!r.id ||
      !!r.return_id ||
      !!r.shipping ||
      !!r.tracking_number ||
      !!r.shipment_id;

    if (!hasPhysical) continue;
    if (CLOSED_RETURN_STATUSES.has(status)) continue;
    if (OPEN_RETURN_STATUSES.has(status) || status === "") {
      // status vazio + objeto físico presente = tratamos como aberto
      return { open: true, status: status || "pending", hasPhysical: true };
    }
    // Status desconhecido, mas não fechado explicitamente → considera aberto
    return { open: true, status, hasPhysical: true };
  }
  return { open: false, status: null, hasPhysical: false };
}

function pickReturnObject(returnData: any): any | null {
  if (!returnData) return null;
  if (Array.isArray(returnData)) return returnData[0] ?? null;
  if (Array.isArray(returnData.data)) return returnData.data[0] ?? null;
  if (Array.isArray(returnData.results)) return returnData.results[0] ?? null;
  return returnData;
}

async function syncConnection(supabase: any, conn: any) {
  const result = {
    seller_id: conn.ml_user_id,
    company_id: conn.company_id,
    fetched: 0,
    physicalOpen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  const token = conn.access_token;
  const sellerId = conn.ml_user_id;
  if (!token || !sellerId) {
    result.errors.push("missing_token_or_seller");
    return result;
  }

  // 1. Buscar claims stage=claim
  let claims: any[] = [];
  try {
    const r = await fetch(
      `${ML_API_BASE}/post-purchase/v1/claims/search?stage=claim&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) {
      result.errors.push(`claims_search_${r.status}`);
      return result;
    }
    const body = await r.json();
    claims = body.data || body.results || [];
    result.fetched = claims.length;
  } catch (e: any) {
    result.errors.push(`claims_search_error:${e.message}`);
    return result;
  }

  for (const claim of claims) {
    try {
      const claimId = claim.id;
      if (!claimId) { result.skipped++; continue; }

      // 2. Confirmar devolução física
      let returnPayload: any = null;
      try {
        const rr = await fetch(
          `${ML_API_BASE}/post-purchase/v2/claims/${claimId}/returns`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (rr.status === 404) { result.skipped++; continue; }
        if (!rr.ok) { result.skipped++; continue; }
        returnPayload = await rr.json();
      } catch {
        result.skipped++;
        continue;
      }

      const { open } = isOpenPhysicalReturn(returnPayload);
      if (!open) { result.skipped++; continue; }
      result.physicalOpen++;

      const returnObj = pickReturnObject(returnPayload) || {};
      const mlReturnId = String(returnObj.id || returnObj.return_id || "");
      const mlOrderId =
        claim.resource === "order" && claim.resource_id
          ? String(claim.resource_id)
          : null;

      // 3. Upsert seguro por (company_id, external_id)
      const { data: existing, error: existingErr } = await supabase
        .from("returns")
        .select("id")
        .eq("company_id", conn.company_id)
        .eq("external_id", String(claimId))
        .maybeSingle();

      if (existingErr) {
        result.errors.push(`select_${claimId}:${existingErr.message}`);
        result.skipped++;
        continue;
      }

      let returnRowId: string | null = existing?.id ?? null;

      if (existing) {
        const { error: updErr } = await supabase
          .from("returns")
          .update({
            status: "pendente",
            source: "mercado_livre",
            order_reference: mlOrderId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (updErr) {
          result.errors.push(`update_${claimId}:${updErr.message}`);
          result.skipped++;
          continue;
        }
        result.updated++;

        const { error: actionErr } = await supabase.from("return_actions").insert({
          return_id: existing.id,
          company_id: conn.company_id,
          action: "updated",
          user_id: conn.user_id,
          details: { source: "ml_claim", claim_id: String(claimId), ml_return_id: mlReturnId || null },
        });
        if (actionErr) result.errors.push(`action_${claimId}:${actionErr.message}`);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("returns")
          .insert({
            company_id: conn.company_id,
            numero: `ML-${claimId}`,
            external_id: String(claimId),
            order_reference: mlOrderId,
            source: "mercado_livre",
            status: "pendente",
            motivo: claim.reason_id || "Devolução Mercado Livre",
            created_by: conn.user_id,
            notes: mlReturnId ? `ML return_id: ${mlReturnId}` : null,
          })
          .select("id")
          .single();

        if (insErr) {
          result.errors.push(`insert_${claimId}:${insErr.message}`);
          continue;
        }
        returnRowId = inserted.id;
        result.inserted++;

        const { error: actionErr } = await supabase.from("return_actions").insert({
          return_id: inserted.id,
          company_id: conn.company_id,
          action: "created",
          user_id: conn.user_id,
          details: { source: "ml_claim", claim_id: String(claimId), ml_return_id: mlReturnId || null },
        });
        if (actionErr) result.errors.push(`action_${claimId}:${actionErr.message}`);
      }

      // 4. Itens: só se novo e houver ml_order_id
      if (!existing && returnRowId && mlOrderId) {
        const { data: mlOrder } = await supabase
          .from("ml_orders")
          .select("id")
          .eq("company_id", conn.company_id)
          .eq("ml_order_id", Number(mlOrderId))
          .maybeSingle();

        if (mlOrder?.id) {
          const { data: items } = await supabase
            .from("ml_order_items")
            .select("product_id, sku, ml_item_title, quantity")
            .eq("ml_order_id", mlOrder.id);

          if (items && items.length > 0) {
            const rows = items.map((it: any) => ({
              return_id: returnRowId,
              company_id: conn.company_id,
              product_id: it.product_id,
              sku: it.sku,
              nome_produto: it.ml_item_title,
              expected_quantity: it.quantity || 1,
              received_quantity: 0,
            }));
            const { error: itemsErr } = await supabase.from("return_items").insert(rows);
            if (itemsErr) result.errors.push(`items_${claimId}:${itemsErr.message}`);
          }
        }
      }
    } catch (e: any) {
      result.errors.push(`claim_${claim?.id}:${e.message}`);
    }
  }

  return result;
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // --- Autenticação ---
  const authHeader = req.headers.get("Authorization");
  const cronSecret = req.headers.get("x-cron-secret");

  let expectedCron = Deno.env.get("CRON_SECRET") ?? null;
  if (cronSecret) {
    try {
      const { data: vaultSecret } = await supabase.rpc("get_cron_secret");
      if (vaultSecret) expectedCron = vaultSecret as unknown as string;
    } catch (_) {}
  }
  const isCron = !!expectedCron && !!cronSecret && cronSecret === expectedCron;

  let userCompanyId: string | null = null;
  let userId: string | null = null;

  if (!isCron) {
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error } = await supabase.auth.getUser(token);
    if (error || !userRes?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    userId = userRes.user.id;
    const { data: prof } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    userCompanyId = prof?.company_id ?? null;
    if (!userCompanyId) {
      return json({ error: "Usuário sem empresa vinculada" }, 400);
    }
  }

  // --- Buscar conexões ML ---
  let query = supabase
    .from("ml_connections")
    .select("id, user_id, company_id, access_token, ml_user_id, seller_nickname")
    .eq("is_active", true);

  if (!isCron && userCompanyId) {
    query = query.eq("company_id", userCompanyId);
  }

  const { data: conns, error: connErr } = await query;
  if (connErr) return json({ error: connErr.message }, 500);
  if (!conns || conns.length === 0) {
    return json({
      success: true,
      fetched: 0,
      physicalOpen: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      message: "Nenhuma conexão ML ativa",
    });
  }

  const totals = {
    success: true,
    fetched: 0,
    physicalOpen: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
    perConnection: [] as any[],
  };

  for (const conn of conns) {
    const r = await syncConnection(supabase, conn);
    totals.fetched += r.fetched;
    totals.physicalOpen += r.physicalOpen;
    totals.inserted += r.inserted;
    totals.updated += r.updated;
    totals.skipped += r.skipped;
    totals.errors.push(...r.errors);
    totals.perConnection.push(r);
  }

    return json(totals);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[ml-returns-sync] fatal", { message, stack });
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        stage: "ml-returns-sync",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
