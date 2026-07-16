// Edge Function: return-process
// Processa decisão de devolução: aprovar → estoque, divergente → quarentena
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
    const { returnId, action, userId } = await req.json();

    if (!returnId || !action) {
      return new Response(JSON.stringify({ error: "returnId e action são obrigatórios" }), { status: 400, headers: corsHeaders });
    }

    // Fetch return with items
    const { data: ret, error: retError } = await supabase
      .from("returns")
      .select("*, return_items(*, products(id, name, stock_physical))")
      .eq("id", returnId)
      .maybeSingle();

    if (retError || !ret) throw retError || new Error("Devolução não encontrada");

    if (action === "approve") {
      // Update stock for approved items
      for (const item of ret.return_items || []) {
        if (!item.product_id || !item.condition || item.condition === "good") {
          const product = (item as any).products;
          if (product && item.approved_quantity > 0) {
            const newStock = (product.stock_physical || 0) + item.approved_quantity;
            await supabase
              .from("products")
              .update({ stock_physical: newStock })
              .eq("id", item.product_id);

            await supabase.from("stock_movement_logs").insert({
              product_id: item.product_id,
              company_id: ret.company_id,
              type: "entrada",
              quantity: item.approved_quantity,
              old_stock: product.stock_physical || 0,
              new_stock: newStock,
              stock_type: "physical",
              reference_id: returnId,
              reference_type: "return",
              notes: `Devolução aprovada - ${item.nome_produto || product.name}`,
            });
          }
        }
      }

      await supabase
        .from("returns")
        .update({ status: "concluida", decisions_made_by: userId || null, conferencia_finalizada_em: new Date().toISOString() })
        .eq("id", returnId);

      await supabase.from("return_actions").insert({
        return_id: returnId,
        company_id: ret.company_id,
        action: "stock_updated",
        description: "Estoque atualizado com itens aprovados",
        user_id: userId || null,
        metadata: { action: "approve" },
      });
    } else if (action === "quarantine") {
      // Move divergent items to quarantine
      for (const item of ret.return_items || []) {
        if (item.condition && item.condition !== "good" && item.received_quantity > 0) {
          const quarantineQty = item.received_quantity - (item.approved_quantity || 0);
          if (quarantineQty > 0) {
            await supabase.from("quarantine_stock").insert({
              company_id: ret.company_id,
              product_id: item.product_id,
              quantity: quarantineQty,
              source_type: "return",
              source_id: returnId,
              reason: item.condition_notes || item.condition || "Divergente",
              status: "quarantined",
            });
          }
        }
      }

      await supabase
        .from("returns")
        .update({ status: "concluida", decisions_made_by: userId || null, conferencia_finalizada_em: new Date().toISOString() })
        .eq("id", returnId);

      await supabase.from("return_actions").insert({
        return_id: returnId,
        company_id: ret.company_id,
        action: "items_quarantined",
        description: "Itens divergentes enviados para quarentena",
        user_id: userId || null,
        metadata: { action: "quarantine" },
      });
    }

    return new Response(JSON.stringify({ success: true, action }), { headers: corsHeaders });
  } catch (err: any) {
    console.error("Erro ao processar devolução:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});