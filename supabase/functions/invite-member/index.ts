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

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "invite";

    const body = await req.json();
    const { companyId } = body;

    if (!companyId || typeof companyId !== "string") {
      return new Response(
        JSON.stringify({ error: "ID da empresa é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is owner or global admin
    const [callerMembershipRes, isGlobalAdminRes] = await Promise.all([
      adminClient
        .from("company_members")
        .select("role")
        .eq("company_id", companyId)
        .eq("user_id", callerId)
        .eq("is_active", true)
        .maybeSingle(),
      adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    const isOwner = callerMembershipRes.data?.role === "owner";
    const isGlobalAdmin = !!isGlobalAdminRes.data;

    if (!isGlobalAdmin && !isOwner) {
      return new Response(
        JSON.stringify({ error: "Apenas o proprietário ou administradores podem gerenciar membros" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === INVITE ===
    if (action === "invite") {
      const { email, role } = body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return new Response(
          JSON.stringify({ error: "E-mail inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validRoles = ["member", "manager"];
      const memberRole = validRoles.includes(role) ? role : "member";

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
        await adminClient
          .from("company_members")
          .update({ is_active: true, role: memberRole })
          .eq("id", existingMember.id);
      } else {
        const { error: insertError } = await adminClient
          .from("company_members")
          .insert({ company_id: companyId, user_id: targetUser.id, role: memberRole });

        if (insertError) {
          return new Response(
            JSON.stringify({ error: "Erro ao adicionar membro" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Membro adicionado com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === REMOVE ===
    if (action === "remove") {
      const { memberId } = body;

      if (!memberId || typeof memberId !== "string") {
        return new Response(
          JSON.stringify({ error: "ID do membro é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch the member to validate
      const { data: member } = await adminClient
        .from("company_members")
        .select("id, user_id, role, company_id")
        .eq("id", memberId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!member) {
        return new Response(
          JSON.stringify({ error: "Membro não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Cannot remove the owner
      if (member.role === "owner") {
        return new Response(
          JSON.stringify({ error: "Não é possível remover o proprietário da empresa" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Cannot remove yourself
      if (member.user_id === callerId) {
        return new Response(
          JSON.stringify({ error: "Não é possível remover a si mesmo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deactivate instead of hard delete
      const { error: updateError } = await adminClient
        .from("company_members")
        .update({ is_active: false })
        .eq("id", memberId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Erro ao remover membro" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Membro removido com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === CHANGE ROLE ===
    if (action === "change-role") {
      const { memberId, newRole } = body;

      if (!memberId || typeof memberId !== "string") {
        return new Response(
          JSON.stringify({ error: "ID do membro é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validRoles = ["member", "manager"];
      if (!validRoles.includes(newRole)) {
        return new Response(
          JSON.stringify({ error: "Papel inválido. Use 'member' ou 'manager'." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: member } = await adminClient
        .from("company_members")
        .select("id, user_id, role, company_id")
        .eq("id", memberId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (!member) {
        return new Response(
          JSON.stringify({ error: "Membro não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (member.role === "owner") {
        return new Response(
          JSON.stringify({ error: "Não é possível alterar o papel do proprietário" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await adminClient
        .from("company_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Erro ao alterar papel" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Papel alterado com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("invite-member error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
