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
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { quarantineId, destination, notes } = await req.json();
    if (!quarantineId || !destination) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: q } = await supabase
      .from("quarantine_stock")
      .select("*")
      .eq("id", quarantineId)
      .maybeSingle();
    if (!q) throw new Error("not_found");

    if (destination === "estoque" && q.product_id && q.quantity > 0) {
      const { data: prod } = await supabase
        .from("products")
        .select("stock_physical")
        .eq("id", q.product_id)
        .maybeSingle();
      const oldStock = prod?.stock_physical ?? 0;
      await supabase.from("products").update({ stock_physical: oldStock + q.quantity }).eq("id", q.product_id);
      await supabase.from("stock_movement_logs").insert({
        product_id: q.product_id,
        company_id: q.company_id,
        user_id: userRes.user.id,
        type: "entrada",
        quantity: q.quantity,
        old_stock: oldStock,
        new_stock: oldStock + q.quantity,
        stock_type: "physical",
        reference_id: q.return_id,
        reference_type: "manual",
        notes: `Liberação de quarentena (edge)`,
      });
    }

    await supabase.from("quarantine_stock").update({
      status: destination === "estoque" ? "liberado" : "descartado",
      released_at: new Date().toISOString(),
      released_by: userRes.user.id,
      released_to: destination,
      notes: notes ?? null,
    }).eq("id", quarantineId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
