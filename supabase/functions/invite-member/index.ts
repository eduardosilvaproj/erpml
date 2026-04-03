import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Verify caller
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

    const callerId = claimsData.claims.sub;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Parse and validate input
    const { email, companyId, role } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "E-mail inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!companyId || typeof companyId !== "string") {
      return new Response(
        JSON.stringify({ error: "ID da empresa é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validRoles = ["member", "manager"];
    const memberRole = validRoles.includes(role) ? role : "member";

    // Verify caller is owner or admin of the company
    const { data: callerMembership } = await adminClient
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", callerId)
      .eq("is_active", true)
      .maybeSingle();

    const { data: isGlobalAdmin } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!isGlobalAdmin && callerMembership?.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Apenas o proprietário ou administradores podem convidar membros" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find user by email using admin API
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers({
      perPage: 1,
    });

    // Search through all users for the email match
    const { data: allUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const targetUser = allUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado. Peça para a pessoa criar uma conta primeiro." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already a member
    const { data: existingMember } = await adminClient
      .from("company_members")
      .select("id, is_active")
      .eq("company_id", companyId)
      .eq("user_id", targetUser.id)
      .maybeSingle();

    if (existingMember) {
      if (existingMember.is_active) {
        return new Response(
          JSON.stringify({ error: "Este usuário já é membro da empresa" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Reactivate inactive member
      await adminClient
        .from("company_members")
        .update({ is_active: true, role: memberRole })
        .eq("id", existingMember.id);
    } else {
      // Add new member
      const { error: insertError } = await adminClient
        .from("company_members")
        .insert({
          company_id: companyId,
          user_id: targetUser.id,
          role: memberRole,
        });

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Erro ao adicionar membro: " + insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Membro adicionado com sucesso" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("invite-member error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
