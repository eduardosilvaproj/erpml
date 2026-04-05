import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user with anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Check admin role using service role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (req.method === "GET" ? "list-users" : null);

    // List all users
    if (action === "list-users") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({
        perPage: 100,
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get profiles and roles
      const { data: profiles } = await adminClient.from("profiles").select("*");
      const { data: roles } = await adminClient.from("user_roles").select("*");

      const enrichedUsers = users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        full_name: profiles?.find((p) => p.id === u.id)?.full_name || "",
        roles: roles?.filter((r) => r.user_id === u.id).map((r) => r.role) || [],
      }));

      return new Response(JSON.stringify({ users: enrichedUsers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Toggle role
    if (action === "toggle-role") {
      const { targetUserId, role } = await req.json();

      if (!targetUserId || !role) {
        return new Response(
          JSON.stringify({ error: "targetUserId e role são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!["admin", "moderator", "user"].includes(role)) {
        return new Response(
          JSON.stringify({ error: "Role inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if role exists
      const { data: existing } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("role", role)
        .maybeSingle();

      if (existing) {
        // Don't allow removing own admin role
        if (targetUserId === userId && role === "admin") {
          return new Response(
            JSON.stringify({ error: "Não é possível remover seu próprio papel de admin" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        await adminClient.from("user_roles").delete().eq("id", existing.id);
        return new Response(JSON.stringify({ removed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        await adminClient.from("user_roles").insert({ user_id: targetUserId, role });
        return new Response(JSON.stringify({ added: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Delete user
    if (action === "delete-user") {
      const { targetUserId } = await req.json();

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: "targetUserId é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (targetUserId === userId) {
        return new Response(
          JSON.stringify({ error: "Não é possível excluir sua própria conta" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await adminClient.auth.admin.deleteUser(targetUserId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List pending users (no company)
    if (action === "list-pending-users") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 100 });
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: members } = await adminClient.from("company_members").select("user_id");
      const { data: profiles } = await adminClient.from("profiles").select("*");
      const memberUserIds = new Set((members || []).map((m) => m.user_id));

      const pendingUsers = users
        .filter((u) => !memberUserIds.has(u.id))
        .map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          email_confirmed_at: u.email_confirmed_at,
          full_name: profiles?.find((p) => p.id === u.id)?.full_name || "",
        }));

      return new Response(JSON.stringify({ users: pendingUsers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create company for a pending user
    if (action === "create-company-for-user") {
      const { targetUserId, companyName, planId } = await req.json();

      if (!targetUserId || !companyName?.trim()) {
        return new Response(
          JSON.stringify({ error: "targetUserId e companyName são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check user doesn't already have a company
      const { data: existingMember } = await adminClient
        .from("company_members")
        .select("id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: "Usuário já possui uma empresa" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create company
      const { data: company, error: companyError } = await adminClient
        .from("companies")
        .insert({
          name: companyName.trim(),
          owner_id: targetUserId,
          plan_id: planId || null,
          status: "active",
        })
        .select()
        .single();

      if (companyError) {
        return new Response(
          JSON.stringify({ error: companyError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add user as owner member
      const { error: memberError } = await adminClient
        .from("company_members")
        .insert({
          company_id: company.id,
          user_id: targetUserId,
          role: "owner",
          is_active: true,
        });

      if (memberError) {
        return new Response(
          JSON.stringify({ error: memberError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ created: true, company }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("admin-users error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
