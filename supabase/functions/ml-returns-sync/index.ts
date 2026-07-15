import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { handleCors, makeCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = makeCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const cronSecretHeader = req.headers.get("x-cron-secret") ?? "";
    const expectedCronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const isCron = !!cronSecretHeader && cronSecretHeader === expectedCronSecret;

    if (!isCron && !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Body pode vir vazio no cron
    const body = await req.json().catch(() => ({}));

    // Determina alvos (empresas + conexões ML) a sincronizar
    type Target = { companyId: string; userId: string; accessToken: string; sellerId: string | null };
    const targets: Target[] = [];

    if (isCron) {
      // Cron: sincroniza todas as conexões ML ativas
      const { data: conns } = await supabase
        .from("ml_connections")
        .select("user_id, access_token, seller_id");
      for (const c of conns ?? []) {
        if (!c.access_token) continue;
        // Descobre a company_id do usuário via profiles
        const { data: prof } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", c.user_id)
          .maybeSingle();
        if (!prof?.company_id) continue;
        targets.push({
          companyId: prof.company_id,
          userId: c.user_id,
          accessToken: c.access_token,
          sellerId: c.seller_id ?? null,
        });
      }
    } else {
      // Chamada manual: usa o usuário autenticado
      const { data: userRes } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      const user = userRes?.user;
      if (!user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let companyId: string | undefined = body.companyId;
      if (!companyId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();
        companyId = prof?.company_id ?? undefined;
      }
      if (!companyId) {
        return new Response(JSON.stringify({ error: "companyId not found for user" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: conn } = await supabase
        .from("ml_connections")
        .select("access_token, seller_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!conn?.access_token) {
        return new Response(JSON.stringify({ error: "ML não conectado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targets.push({
        companyId,
        userId: user.id,
        accessToken: conn.access_token,
        sellerId: conn.seller_id ?? null,
      });
    }

    let totalCreated = 0;
    let totalSkipped = 0;
    let totalClaims = 0;
    const perTarget: any[] = [];

    for (const t of targets) {
      const url = `https://api.mercadolibre.com/post-purchase/v1/claims/search?stage=claim&limit=50`;
      const mlRes = await fetch(url, {
        headers: { Authorization: `Bearer ${t.accessToken}` },
      });
      if (!mlRes.ok) {
        const detail = await mlRes.text();
        perTarget.push({ companyId: t.companyId, error: "ml_fetch_failed", detail });
        continue;
      }
      const payload = await mlRes.json();
      const claims: any[] = payload?.data ?? payload?.results ?? [];
      totalClaims += claims.length;

      let created = 0;
      let skipped = 0;

      for (const c of claims) {
        const externalId = String(c.id ?? c.claim_id ?? "");
        if (!externalId) { skipped++; continue; }

        const { data: exists } = await supabase
          .from("returns")
          .select("id")
          .eq("company_id", t.companyId)
          .eq("external_id", externalId)
          .maybeSingle();
        if (exists) { skipped++; continue; }

        const orderRef = String(c.resource_id ?? c.order_id ?? "");
        const numero = `ML-${externalId}`;
        const { data: inserted, error } = await supabase
          .from("returns")
          .insert({
            company_id: t.companyId,
            numero,
            source: "mercado_livre",
            external_id: externalId,
            status: "pendente",
            order_reference: orderRef || null,
            motivo: c.reason?.name ?? c.reason_id ?? null,
          })
          .select("id")
          .single();

        if (error || !inserted) { skipped++; continue; }
        created++;

        // Tenta hidratar return_items com base numa ml_order existente
        if (orderRef) {
          const { data: mlOrder } = await supabase
            .from("ml_orders")
            .select("id")
            .eq("company_id", t.companyId)
            .eq("ml_order_id", orderRef)
            .maybeSingle();
          if (mlOrder?.id) {
            const { data: mlItems } = await supabase
              .from("ml_order_items")
              .select("product_id, sku, ean, title, quantity")
              .eq("ml_order_id", mlOrder.id);
            if (mlItems && mlItems.length) {
              const rows = mlItems.map((it: any) => ({
                return_id: inserted.id,
                company_id: t.companyId,
                product_id: it.product_id ?? null,
                sku: it.sku ?? null,
                ean: it.ean ?? null,
                nome_produto: it.title ?? null,
                expected_quantity: it.quantity ?? 1,
              }));
              await supabase.from("return_items").insert(rows);
            }
          }
        }
      }

      totalCreated += created;
      totalSkipped += skipped;
      perTarget.push({ companyId: t.companyId, created, skipped, claims: claims.length });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mode: isCron ? "cron" : "manual",
        created: totalCreated,
        skipped: totalSkipped,
        total: totalClaims,
        targets: perTarget,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
