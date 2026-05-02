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

    const { amount, type, company_id, description } = await req.json();

    // 1. Validar valores
    if (typeof amount !== "number" || amount <= 0) {
      throw new Error("Valor deve ser positivo");
    }

    // 2. Verificar permissões (apenas manager ou owner para financeiro)
    const { data: member } = await supabase
      .from("company_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .single();
    
    if (!member || !["owner", "manager", "admin_master"].includes(member.role)) {
      throw new Error("Permissão insuficiente para operações financeiras");
    }

    // 3. Auditoria
    await supabase.from("company_audit_log").insert({
      company_id,
      user_id: user.id,
      action: "financial_validation",
      details: { amount, type, description }
    });

    return new Response(
      JSON.stringify({ valid: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
