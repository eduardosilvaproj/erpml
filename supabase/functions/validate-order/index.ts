import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader! } },
    });
    
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { items, company_id, external_id } = await req.json();

    // 1. Prevenir duplicados (ex: por external_id do marketplace)
    if (external_id) {
      const { data: existing } = await supabase
        .from("sales")
        .select("id")
        .eq("company_id", company_id)
        .eq("external_id", external_id)
        .maybeSingle();
      
      if (existing) throw new Error("Pedido já processado (duplicado)");
    }

    // 2. Validar itens e estoque
    let total = 0;
    for (const item of items) {
      const { data: product } = await supabase
        .from("products")
        .select("id, stock_physical, price")
        .eq("id", item.product_id)
        .eq("company_id", company_id)
        .single();
      
      if (!product) throw new Error(`Produto ${item.product_id} não encontrado`);
      if (product.stock_physical < item.quantity) {
        throw new Error(`Estoque insuficiente para o produto ${item.product_id}`);
      }
      total += (item.unit_price || product.price) * item.quantity;
    }

    return new Response(
      JSON.stringify({ valid: true, total_validated: total }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
