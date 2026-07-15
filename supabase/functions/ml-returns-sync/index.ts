// Edge Function: ml-returns-sync — MODO DIAGNÓSTICO
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

  const { data: conn } = await supabase
    .from("ml_connections")
    .select("access_token, ml_user_id, seller_nickname")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!conn?.access_token) {
    return new Response(JSON.stringify({ error: "ML não conectado" }), { status: 400, headers: corsHeaders });
  }

  const token = conn.access_token;
  const sellerId = conn.ml_user_id;
  const results: any = { seller_id: sellerId, tests: [] };

  try {
    const r1 = await fetch(`${ML_API_BASE}/post-purchase/v1/claims/search?seller_id=${sellerId}&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    results.tests.push({ endpoint: "/post-purchase/v1/claims/search (sem stage)", status: r1.status, body: await r1.json().catch(() => "erro parse") });
  } catch (e: any) { results.tests.push({ endpoint: "/post-purchase/v1/claims/search", error: e.message }); }

  try {
    const r2 = await fetch(`${ML_API_BASE}/post-purchase/v1/claims/search?seller_id=${sellerId}&stage=return&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    results.tests.push({ endpoint: "/post-purchase/v1/claims/search?stage=return", status: r2.status, body: await r2.json().catch(() => "erro parse") });
  } catch (e: any) { results.tests.push({ endpoint: "/post-purchase/v1/claims/search?stage=return", error: e.message }); }

  try {
    const r3 = await fetch(`${ML_API_BASE}/orders/search?seller=${sellerId}&order.status=cancelled&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    results.tests.push({ endpoint: "/orders/search?order.status=cancelled", status: r3.status, body: await r3.json().catch(() => "erro parse") });
  } catch (e: any) { results.tests.push({ endpoint: "/orders/search?order.status=cancelled", error: e.message }); }

  try {
    const r4 = await fetch(`${ML_API_BASE}/returns/search?seller_id=${sellerId}&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    results.tests.push({ endpoint: "/returns/search", status: r4.status, body: await r4.json().catch(() => "erro parse") });
  } catch (e: any) { results.tests.push({ endpoint: "/returns/search", error: e.message }); }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
