import { makeCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";


Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = makeCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Verify password
    const { password, confirmation, dryRun } = await req.json();
    if (confirmation !== "CONFIRMAR") {
      return new Response(JSON.stringify({ error: "Confirmação inválida" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!password || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "Senha obrigatória" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Check admin role
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado: apenas administradores" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Validate password by attempting sign-in
    const { error: pwErr } = await userClient.auth.signInWithPassword({
      email: user.email!,
      password,
    });
    if (pwErr) {
      return new Response(JSON.stringify({ error: "Senha incorreta" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Tables to wipe (operational data only — preserve companies/users/plans/ml_connections)
    const tables = [
      "conference_items", "conferences",
      "invoice_payments", "invoice_items", "invoices",
      "kit_items", "product_kits",
      "campaign_items", "campaigns",
      "sale_items", "sales",
      "transfer_items", "transfer_orders",
      "ml_order_items", "ml_orders", "ml_questions", "ml_sync_logs", "ml_linked_products",
      "store_orders", "store_products",
      "product_suppliers", "product_watchlist",
      "customers", "suppliers",
      "products", "categories",
    ];

    const counts: Record<string, number> = {};
    const sqlList: string[] = [];

    for (const table of tables) {
      try {
        const { count: before } = await admin.from(table).select("*", { count: "exact", head: true });
        counts[table] = before || 0;
        
        sqlList.push(`TRUNCATE TABLE public.${table} CASCADE;`);

        if (!dryRun) {
          const { error } = await admin.from(table).delete().not("id", "is", null);
          if (error) {
            counts[table] = -1;
            console.error(`Failed wiping ${table}:`, error.message);
          }
        }
      } catch (e) {
        console.error(`Exception processing ${table}:`, e);
        counts[table] = -1;
      }
    }

    // Stats
    const { count: companiesCount } = await admin.from("companies").select("*", { count: "exact", head: true });
    const { count: usersCount } = await admin.from("profiles").select("*", { count: "exact", head: true });

    if (!dryRun) {
      // Log only on actual execution
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
      await admin.from("system_logs").insert({
        action: "SYSTEM_RESET",
        user_id: user.id,
        user_email: user.email,
        ip_address: ip,
        details: { tables: counts, companies_kept: companiesCount, users_kept: usersCount },
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        dryRun, 
        sql: sqlList.join("\n"), 
        tables: tables.map(t => ({ name: t, count: counts[t] })), 
        companies: companiesCount, 
        users: usersCount 
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("system-reset error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro interno" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
