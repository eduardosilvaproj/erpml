// Edge Function: ml-returns-sync
// Sincroniza devoluções do Mercado Livre via API post-purchase/v1/claims
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

  // === Body: dryRun opcional ===
  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
  } catch (_) {
    // sem body (ex: cron) -> fluxo normal
  }

  // === AUTH: CRON_SECRET (cron) ou usuário autenticado (manual, escopado à empresa) ===
  const authHeader = req.headers.get("Authorization");
  const cronSecret = req.headers.get("x-cron-secret");
  let expectedCronSecret = Deno.env.get("CRON_SECRET") ?? null;
  if (cronSecret) {
    try {
      const { data: vaultSecret } = await supabase.rpc("get_cron_secret");
      if (vaultSecret) expectedCronSecret = vaultSecret as unknown as string;
    } catch (_) {}
  }
  const hasCronAuth = !!expectedCronSecret && !!cronSecret && cronSecret === expectedCronSecret;

  let requesterUserId: string | null = null;

  if (!hasCronAuth) {
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });
    }
    requesterUserId = claimsData.claims.sub as string;
  }

  // Escopo: manual = apenas conexões da empresa do solicitante; cron = todas as empresas com auto-sync ligado
  let allowedUserIds: string[] | null = null;
  if (requesterUserId) {
    const { data: requesterProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", requesterUserId)
      .maybeSingle();
    const requesterCompanyId = requesterProfile?.company_id ?? null;
    if (!requesterCompanyId) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada para o usuário." }), { status: 403, headers: corsHeaders });
    }
    const { data: companyProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", requesterCompanyId);
    allowedUserIds = (companyProfiles ?? []).map((p) => p.id as string);
    if (!allowedUserIds.length) {
      return new Response(JSON.stringify({ success: true, synced: 0 }), { headers: corsHeaders });
    }
  }

  try {
    let connQuery = supabase.from("ml_connections").select("*").eq("is_active", true);
    if (allowedUserIds) connQuery = connQuery.in("user_id", allowedUserIds);
    const { data: connections, error: connError } = await connQuery;

    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ synced: 0, message: "Nenhuma conexão ML ativa" }), { headers: corsHeaders });
    }

    let totalSynced = 0;
    const diagnostics: any[] = [];

    for (const conn of connections) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", conn.user_id)
        .maybeSingle();

      const companyId = profile?.company_id;
      if (!companyId) {
        console.warn(`[ml-returns-sync] Conexão ${conn.ml_user_id} sem company_id associada.`);
        continue;
      }

      // Sync automático (cron): respeita a config de auto-sync do usuário
      if (!requesterUserId) {
        const { data: settings } = await supabase
          .from("ml_settings")
          .select("auto_sync_orders")
          .eq("user_id", conn.user_id)
          .maybeSingle();
        if (settings && !settings.auto_sync_orders) continue;
      }

      // Refresh token se expirado
      let accessToken = conn.access_token;
      const expiresAt = new Date(conn.token_expires_at ?? 0).getTime();
      if (Date.now() + 5 * 60 * 1000 >= expiresAt) {
        const mlAppId = Deno.env.get("MERCADO_LIVRE_APP_ID");
        const mlSecret = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET");
        if (!mlAppId || !mlSecret) {
          console.error(`[ml-returns-sync] Refresh abortado — secrets faltando.`);
          continue;
        }

        const refreshRes = await fetch(`${ML_API_BASE}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: mlAppId,
            client_secret: mlSecret,
            refresh_token: conn.refresh_token,
          }),
        });

        if (refreshRes.ok) {
          const tokenData = await refreshRes.json();
          accessToken = tokenData.access_token;
          await supabase
            .from("ml_connections")
            .update({
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token || conn.refresh_token,
              token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            })
            .eq("id", conn.id);
        } else {
          console.error(`Falha ao renovar token para ${conn.ml_user_id}`);
          continue;
        }
      }

      // Busca claims em aberto (status=opened) com tipo=return
      // Inclui todos os estágios: claim, dispute, recontact, return (pendentes e em andamento)
      const claimsRes = await fetch(
        `${ML_API_BASE}/post-purchase/v1/claims/search?seller_id=${conn.ml_user_id}&type=return&status=opened&limit=100`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!claimsRes.ok) {
        console.error(`Erro ao buscar claims para ${conn.ml_user_id}: ${claimsRes.status}`);
        if (dryRun) {
          diagnostics.push({ seller_id: conn.ml_user_id, ml_status: claimsRes.status, error: true });
        }
        continue;
      }

      const claimsData = await claimsRes.json();
      const claims = claimsData.data || claimsData.results || [];

      if (dryRun) {
        diagnostics.push({
          seller_id: conn.ml_user_id,
          company_id: companyId,
          claims_found: claims.length,
          claims: claims.map((c: any) => ({ id: c.id, status: c.status, order_id: c.order_id })),
        });
        continue;
      }

      for (const claim of claims) {
        const { data: existing } = await supabase
          .from("returns")
          .select("id")
          .eq("ml_claim_id", String(claim.id))
          .eq("company_id", companyId)
          .maybeSingle();

        if (existing) continue;

        const mlStatus = claim.status || "pending";
        const statusMap: Record<string, string> = {
          // Statuses abertos/pendentes
          pending: "pendente_recebimento",
          opened: "pendente_recebimento",
          claim: "pendente_recebimento",
          dispute: "pendente_recebimento",
          recontact: "pendente_recebimento",
          // Statuses de envio/devolução
          shipped: "em_transito",
          return_in_transit: "em_transito",
          return_delivered: "recebido",
          // Statuses finalizados
          delivered: "recebido",
          received: "recebido",
          closed: "concluida",
          cancelled: "cancelada",
          failed: "cancelada",
          return_to_buyer: "cancelada",
          refunded: "reembolsada",
          not_delivered: "nao_recebida",
        };
        const mappedStatus = statusMap[mlStatus] || "pendente_recebimento";

        const { data: ret, error: retError } = await supabase
          .from("returns")
          .insert({
            company_id: companyId,
            ml_return_id: claim.return_id ? String(claim.return_id) : null,
            ml_order_id: claim.order_id ? String(claim.order_id) : null,
            ml_claim_id: String(claim.id),
            status: mappedStatus as any,
            source: "ml_claim",
            motivo: claim.reason || claim.reason_id || "Devolução via ML",
            created_by: conn.user_id,
          })
          .select()
          .maybeSingle();

        if (retError || !ret) {
          console.error("Erro ao criar devolução:", retError);
          continue;
        }

        if (claim.order_id) {
          const { data: mlOrderItems } = await supabase
            .from("ml_order_items")
            .select("*, products(id, name, sku)")
            .eq("ml_order_id", Number(claim.order_id));

          if (mlOrderItems && mlOrderItems.length > 0) {
            const returnItems = mlOrderItems.map((item: any) => ({
              return_id: ret.id,
              company_id: companyId,
              product_id: item.product_id || null,
              sku: item.products?.sku || item.sku || null,
              nome_produto: item.products?.name || item.ml_item_title || "Produto ML",
              expected_quantity: item.quantity || 1,
            }));
            await supabase.from("return_items").insert(returnItems);
          }
        }

        await supabase.from("return_actions").insert({
          return_id: ret.id,
          company_id: companyId,
          action: "created",
          description: "Devolução sincronizada automaticamente do Mercado Livre",
          metadata: { ml_claim_id: claim.id, ml_status: mlStatus },
        });

        totalSynced++;
      }
    }

    return new Response(
      JSON.stringify(
        dryRun
          ? { success: true, dryRun: true, diagnostics }
          : { success: true, synced: totalSynced, message: `${totalSynced} devolução(ões) sincronizada(s)` }
      ),
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("Erro no sync de devoluções:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});