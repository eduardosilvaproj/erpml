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
    if (!authHeader) throw new Error("No authorization header");
    
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { name, description, price, stock_physical, company_id } = body;

    // 1. Validar company_id
    if (!company_id) throw new Error("company_id é obrigatório");
    const { data: member } = await supabase
      .from("company_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .single();
    
    if (!member) throw new Error("Você não pertence a esta empresa");

    // 2. Validar preço
    if (typeof price !== "number" || price <= 0) {
      throw new Error("Preço deve ser maior que zero");
    }

    // 3. Validar estoque
    if (typeof stock_physical !== "number" || stock_physical < 0) {
      throw new Error("Estoque não pode ser negativo");
    }

    // 4. Sanitizar e validar strings
    if (!name || typeof name !== "string" || name.trim().length < 3) {
      throw new Error("Nome deve ter pelo menos 3 caracteres");
    }

    const sanitizedName = name.trim().substring(0, 200);
    const sanitizedDescription = description?.trim().substring(0, 2000) || "";

    return new Response(
      JSON.stringify({ 
        valid: true, 
        sanitized: { 
          name: sanitizedName, 
          description: sanitizedDescription,
          price,
          stock_physical 
        } 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
