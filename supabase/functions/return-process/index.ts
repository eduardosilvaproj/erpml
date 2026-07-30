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

    const { returnItemId, condition, quantity, notes } = await req.json();
    if (!returnItemId || !condition) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: item, error: itemErr } = await supabase
      .from("return_items")
      .select("*")
      .eq("id", returnItemId)
      .maybeSingle();
    if (itemErr || !item) throw itemErr ?? new Error("item_not_found");

    const decisionDest = condition === "aprovado" ? "estoque" : "quarentena";
    await supabase.from("return_items").update({
      condition,
      decision: decisionDest,
      notes: notes ?? null,
    }).eq("id", returnItemId);

    if (condition === "aprovado" && item.product_id && quantity > 0) {
      const { data: prod } = await supabase
        .from("products")
        .select("stock_physical")
        .eq("id", item.product_id)
        .maybeSingle();
      const oldStock = prod?.stock_physical ?? 0;
      await supabase.from("products").update({ stock_physical: oldStock + quantity }).eq("id", item.product_id);
      await supabase.from("stock_movement_logs").insert({
        product_id: item.product_id,
        company_id: item.company_id,
        user_id: userRes.user.id,
        type: "entrada",
        quantity,
        old_stock: oldStock,
        new_stock: oldStock + quantity,
        stock_type: "physical",
        reference_id: item.return_id,
        reference_type: "manual",
        notes: `Devolução aprovada (edge)`,
      });
    } else {
      await supabase.from("quarantine_stock").insert({
        company_id: item.company_id,
        product_id: item.product_id,
        return_id: item.return_id,
        return_item_id: returnItemId,
        quantity,
        condition,
        status: "em_quarentena",
        reason: notes ?? null,
      });
    }

    await supabase.from("return_actions").insert({
      return_id: item.return_id,
      company_id: item.company_id,
      user_id: userRes.user.id,
      action: "item_decision",
      details: { item_id: returnItemId, condition, quantity },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
