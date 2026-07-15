// Edge Function: ml-returns-sync — DIAGNÓSTICO v2
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
    .select("access_token, ml_user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!conn?.access_token) {
    return new Response(JSON.stringify({ error: "ML não conectado" }), { status: 400, headers: corsHeaders });
  }

  const token = conn.access_token;
  const sellerId = conn.ml_user_id;
  const headers = { Authorization: `Bearer ${token}` };
  const results: any = { seller_id: sellerId, tests: [] };

  const endpoints = [
    `/post-purchase/v1/claims/search?stage=claim&limit=10`,
    `/post-purchase/v1/claims/search?stage=dispute&limit=10`,
    `/post-purchase/v1/claims/search?type=mediations&limit=10`,
    `/post-purchase/v1/claims/search?type=return&limit=10`,
    `/post-purchase/v1/claims/search?type=cancel_purchase&limit=10`,
    `/post-purchase/v1/claims/search?status=opened&limit=10`,
    `/post-purchase/v1/claims/search?status=closed&limit=10`,
    `/post-purchase/v1/claims/search?resource=order&limit=10`,
    `/post-purchase/v2/claims/search?limit=10`,
    `/users/${sellerId}/claims/search?limit=10`,
    `/post-purchase/v1/claims/search?player_role=respondent&limit=10`,
    `/post-purchase/v1/claims/search?player_role=complainant&limit=10`,
  ];

  for (const ep of endpoints) {
    try {
      const r = await fetch(`${ML_API_BASE}${ep}`, { headers });
      const body = await r.json().catch(() => "erro parse");
      results.tests.push({ endpoint: ep, status: r.status, total: (body as any)?.paging?.total, sample: Array.isArray((body as any)?.data) ? (body as any).data.slice(0,2) : body });
    } catch (e: any) {
      results.tests.push({ endpoint: ep, error: e.message });
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
