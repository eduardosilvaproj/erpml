import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { handleCors, makeCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = makeCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userRes } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const companyId: string | undefined = body.companyId;
    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch ML connection tokens
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

    // GET /post-purchase/v1/claims/search
    const url = `https://api.mercadolibre.com/post-purchase/v1/claims/search?stage=claim&limit=50`;
    const mlRes = await fetch(url, {
      headers: { Authorization: `Bearer ${conn.access_token}` },
    });
    if (!mlRes.ok) {
      const t = await mlRes.text();
      return new Response(JSON.stringify({ error: "ml_fetch_failed", detail: t }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = await mlRes.json();
    const claims: any[] = payload?.data ?? payload?.results ?? [];

    let created = 0;
    let skipped = 0;
    for (const c of claims) {
      const externalId = String(c.id ?? c.claim_id ?? "");
      if (!externalId) { skipped++; continue; }
      const { data: exists } = await supabase
        .from("returns")
        .select("id")
        .eq("company_id", companyId)
        .eq("external_id", externalId)
        .maybeSingle();
      if (exists) { skipped++; continue; }

      const numero = `ML-${externalId}`;
      const { error } = await supabase.from("returns").insert({
        company_id: companyId,
        numero,
        source: "mercado_livre",
        external_id: externalId,
        status: "pendente",
        order_reference: String(c.resource_id ?? c.order_id ?? ""),
        motivo: c.reason?.name ?? c.reason_id ?? null,
      });
      if (!error) created++;
    }

    return new Response(JSON.stringify({ ok: true, created, skipped, total: claims.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
