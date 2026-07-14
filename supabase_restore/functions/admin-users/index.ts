import { makeCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = makeCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[admin-users] Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado: Token ausente" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requester }, error: authError } = await adminClient.auth.getUser(token);
    
    if (authError || !requester) {
      console.error("[admin-users] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Não autorizado: Token inválido" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const [roleCheck, masterCheck, adminMasterRoleCheck] = await Promise.all([
      adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", requester.id)
        .eq("role", "admin")
        .maybeSingle(),
      adminClient
        .from("company_members")
        .select("role")
        .eq("user_id", requester.id)
        .eq("role", "admin_master")
        .eq("is_active", true)
        .maybeSingle(),
      adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", requester.id)
        .eq("role", "admin_master")
        .maybeSingle()
    ]);

    if (!roleCheck.data && !masterCheck.data && !adminMasterRoleCheck.data) {
      console.warn(`[admin-users] Access denied for user ${requester.id}`);
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem realizar esta ação." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (req.method === "GET" ? "list-users" : null);
    
    console.log(`[admin-users] Executing action: ${action} for user: ${requester.id}`);

    if (action === "list-users") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      const { data: profiles } = await adminClient.from("profiles").select("*");
      const { data: roles } = await adminClient.from("user_roles").select("*");
      const { data: members } = await adminClient.from("company_members").select("*, companies(name, is_test)");
      const { data: ownedCompanies } = await adminClient.from("companies").select("id, owner_id, is_test");

      const enrichedUsers = users.map((u) => {
        const profile = profiles?.find((p) => p.id === u.id);
        const member = members?.find((m) => m.user_id === u.id && m.is_active !== false && !m.companies?.is_test);
        const owned = ownedCompanies?.find((c) => c.owner_id === u.id && !c.is_test);
        
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
          full_name: profile?.full_name || "",
          company_id: member?.company_id || profile?.company_id || null,
          company_name: member?.companies?.name || null,
          membership_role: member?.role || null,
          owned_company_id: owned?.id || null,
          roles: roles?.filter((r) => r.user_id === u.id).map((r) => r.role) || [],
        };
      });

      return new Response(JSON.stringify({ users: enrichedUsers }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "create-user") {
      const payload = await req.json();
      const { fullName, email, passwordMode, password, companyId, companyName, role } = payload;
      
      console.log(`[admin-users] Creating user: ${email}, role: ${role}`);
      
      let finalPassword = password;
      if (passwordMode === "temporary" || !finalPassword) {
        const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
        finalPassword = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => charset[b % charset.length]).join("");
      }

      const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: finalPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (createError) {
        console.error("[admin-users] Create user error:", createError.message);
        throw createError;
      }
      
      const newUser = userData.user;
      console.log(`[admin-users] User created successfully: ${newUser.id}`);

      try {
        // Create profile if it doesn't exist (triggers usually handle this, but let's be safe/explicit)
        const { error: profileError } = await adminClient.from("profiles").upsert({ 
          id: newUser.id,
          full_name: fullName,
          email: email.trim().toLowerCase()
        });
        
        if (profileError) console.warn("[admin-users] Profile upsert warning:", profileError.message);

        let targetCompanyId = companyId;
        if (role === "owner" && !targetCompanyId && companyName) {
          console.log(`[admin-users] Creating company: ${companyName} for user: ${newUser.id}`);
          const { data: company, error: companyErr } = await adminClient.from("companies").insert({ 
            name: companyName, 
            owner_id: newUser.id,
            status: 'active'
          }).select().single();
          
          if (companyErr) throw companyErr;
          targetCompanyId = company.id;
        }

        if (targetCompanyId) {
          console.log(`[admin-users] Linking user ${newUser.id} to company ${targetCompanyId} as ${role}`);
          const { error: memberError } = await adminClient.from("company_members").insert({
            company_id: targetCompanyId,
            user_id: newUser.id,
            role: role === "admin_master" ? "member" : (role || "member"),
            is_active: true,
          });
          
          if (memberError) throw memberError;
          
          await adminClient.from("profiles").update({ company_id: targetCompanyId }).eq("id", newUser.id);
        }

        if (role === "admin_master") {
          console.log(`[admin-users] Granting admin role to user: ${newUser.id}`);
          await adminClient.from("user_roles").insert({ user_id: newUser.id, role: "admin" });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          user: newUser, 
          temporaryPassword: (passwordMode === "temporary" || !password) ? finalPassword : null 
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      } catch (e: any) {
        console.error("[admin-users] Cleanup: deleting failed user creation:", e.message);
        await adminClient.auth.admin.deleteUser(newUser.id);
        throw e;
      }
    }

    if (action === "update-user") {
      const { targetUserId, fullName, email, password, companyId, role } = await req.json();
      
      const updateAuth: any = {};
      if (email) updateAuth.email = email.trim().toLowerCase();
      if (password) updateAuth.password = password;
      
      if (Object.keys(updateAuth).length > 0) {
        const { error: authErr } = await adminClient.auth.admin.updateUserById(targetUserId, updateAuth);
        if (authErr) throw authErr;
      }

      if (fullName) {
        await adminClient.from("profiles").update({ full_name: fullName }).eq("id", targetUserId);
      }

      if (companyId || role) {
        const { data: currentMember } = await adminClient.from("company_members").select("*").eq("user_id", targetUserId).eq("is_active", true).maybeSingle();
        const finalRole = role || currentMember?.role || "member";
        const finalCompanyId = companyId || currentMember?.company_id;

        if (finalCompanyId) {
          if (currentMember && currentMember.company_id !== finalCompanyId) {
             await adminClient.from("company_members").update({ is_active: false }).eq("id", currentMember.id);
             await adminClient.from("company_members").insert({ company_id: finalCompanyId, user_id: targetUserId, role: finalRole === "admin_master" ? "member" : finalRole, is_active: true });
          } else if (currentMember) {
             await adminClient.from("company_members").update({ role: finalRole === "admin_master" ? "member" : finalRole }).eq("id", currentMember.id);
          } else {
             await adminClient.from("company_members").insert({ company_id: finalCompanyId, user_id: targetUserId, role: finalRole === "admin_master" ? "member" : finalRole, is_active: true });
          }
          await adminClient.from("profiles").update({ company_id: finalCompanyId }).eq("id", targetUserId);
        }

        if (role === "admin_master") {
          const { data: hasRole } = await adminClient.from("user_roles").select("*").eq("user_id", targetUserId).eq("role", "admin").maybeSingle();
          if (!hasRole) await adminClient.from("user_roles").insert({ user_id: targetUserId, role: "admin" });
        } else if (role && role !== "admin_master" && targetUserId !== requester.id) {
          await adminClient.from("user_roles").delete().eq("user_id", targetUserId).eq("role", "admin");
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "list-pending-users") {
      console.log("[admin-users] Listing pending users");
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      
      const { data: members } = await adminClient.from("company_members").select("user_id, is_active, companies(is_test)");
      const { data: profiles } = await adminClient.from("profiles").select("*");
      const { data: roles } = await adminClient.from("user_roles").select("*");
      
      const activeMemberUserIds = new Set(
        (members || [])
          .filter(m => m.is_active !== false && !m.companies?.is_test)
          .map((m) => m.user_id)
      );
      
      const adminUserIds = new Set(
        (roles || [])
          .filter(r => r.role === 'admin' || r.role === 'admin_master')
          .map(r => r.user_id)
      );
      
      const pendingUsers = users
        .filter((u) => !activeMemberUserIds.has(u.id) && !adminUserIds.has(u.id))
        .map((u) => {
          const profile = profiles?.find((p) => p.id === u.id);
          return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            email_confirmed_at: u.email_confirmed_at,
            full_name: profile?.full_name || "",
          };
        });
        
      console.log(`[admin-users] Found ${pendingUsers.length} pending users`);
      return new Response(JSON.stringify({ users: pendingUsers }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "create-company-for-user") {
      const { targetUserId, companyName, planId } = await req.json();
      const { data: company, error: companyError } = await adminClient.from("companies").insert({ name: companyName.trim(), owner_id: targetUserId, plan_id: planId || null }).select().maybeSingle();
      if (companyError) throw companyError;
      
      await adminClient.from("company_members").insert({ company_id: company.id, user_id: targetUserId, role: "owner", is_active: true });
      await adminClient.from("profiles").update({ company_id: company.id }).eq("id", targetUserId);
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "create-company") {
      const data = await req.json();
      const { data: company, error } = await adminClient.from("companies").insert({
        name: data.name,
        plan_id: data.plan_id || null,
        is_courtesy: data.is_courtesy ?? false,
        cnpj: data.cnpj || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        status: data.status || 'active',
        is_test: data.is_test ?? false
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, company }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "set-password" || action === "reset-password") {
      const { targetUserId, passwordMode, password } = await req.json();
      let finalPassword = password;
      if (passwordMode === "temporary") {
        const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
        finalPassword = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => charset[b % charset.length]).join("");
      }
      const { error } = await adminClient.auth.admin.updateUserById(targetUserId, { password: finalPassword });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, temporaryPassword: passwordMode === "temporary" ? finalPassword : null }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "delete-user") {
      const { targetUserId } = await req.json();
      if (targetUserId === requester.id) throw new Error("Não é possível excluir sua própria conta");
      const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    console.error(`[admin-users] Invalid action: ${action}`);
    return new Response(JSON.stringify({ error: "Ação inválida ou não suportada" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error(`[admin-users] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Ocorreu um erro interno no servidor administrativo",
        details: error.toString()
      }), 
      { 
        status: 500, 
        headers: { ...cors, "Content-Type": "application/json" } 
      }
    );
  }
});
