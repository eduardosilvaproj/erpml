// Edge Function: quarantine-release
// Libera item da quarentena de volta ao estoque
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const { quarantineId, action, userId } = await req.json();

    if (!quarantineId || !action) {
      return new Response(JSON.stringify({ error: "quarantineId e action são obrigatórios" }), { status: 400, headers: corsHeaders });
    }

    const { data: item, error: fetchError } = await supabase
      .from("quarantine_stock")
      .select("*, products(id, name, stock_physical)")
      .eq("id", quarantineId)
      .maybeSingle();

    if (fetchError || !item) throw fetchError || new Error("Item não encontrado");

    if (action === "release") {
      const product = (item as any).products;
      const newStock = (product?.stock_physical || 0) + item.quantity;

      await supabase
        .from("products")
        .update({ stock_physical: newStock })
        .eq("id", item.product_id);

      await supabase.from("stock_movement_logs").insert({
        product_id: item.product_id,
        company_id: item.company_id,
        type: "entrada",
        quantity: item.quantity,
        old_stock: product?.stock_physical || 0,
        new_stock: newStock,
        stock_type: "physical",
        reference_id: quarantineId,
        reference_type: "quarantine",
        notes: `Liberado da quarentena - ${item.reason || ""}`,
      });

      await supabase
        .from("quarantine_stock")
        .update({ status: "released", resolved_at: new Date().toISOString(), resolved_by: userId || null, resolution: "returned_to_stock" })
        .eq("id", quarantineId);
    } else if (action === "discard") {
      await supabase
        .from("quarantine_stock")
        .update({ status: "discarded", resolved_at: new Date().toISOString(), resolved_by: userId || null, resolution: "discarded" })
        .eq("id", quarantineId);
    }

    return new Response(JSON.stringify({ success: true, action }), { headers: corsHeaders });
  } catch (err: any) {
    console.error("Erro ao processar quarentena:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});