import { makeCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";


Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = makeCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // contains user_id

  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  const APP_ID = Deno.env.get("MERCADO_LIVRE_APP_ID");
  const CLIENT_SECRET = Deno.env.get("MERCADO_LIVRE_CLIENT_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const missingMl: string[] = [];
  if (!APP_ID) missingMl.push("MERCADO_LIVRE_APP_ID");
  if (!CLIENT_SECRET) missingMl.push("MERCADO_LIVRE_CLIENT_SECRET");
  if (missingMl.length) {
    return new Response(`ML credentials not configured. Missing: ${missingMl.join(", ")}`, { status: 500 });
  }

  const appUrl = Deno.env.get("APP_URL") || "https://erpml.lovable.app";

  // === SECURITY: Validate that state is a real user_id ===
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Validate UUID format to prevent injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(state)) {
    console.error("Invalid state format (not UUID):", state);
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/integracao-ml?error=invalid_state` },
    });
  }

  // Verify the user actually exists in auth system
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(state);
  if (userError || !userData?.user) {
    console.error("State validation failed - user not found:", state);
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/integracao-ml?error=invalid_state` },
    });
  }

  const redirectUri = `${SUPABASE_URL}/functions/v1/ml-oauth-callback`;

  try {
    // Exchange code for tokens
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: APP_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenBody.toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("ML token error:", tokenData);
      return new Response(null, {
        status: 302,
        headers: { Location: `${appUrl}/integracao-ml?error=oauth_failed` },
      });
    }

    const {
      access_token,
      refresh_token,
      expires_in,
      user_id: mlUserId,
    } = tokenData;

    // Get seller info
    const userRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const mlUserData = await userRes.json();
    const sellerNickname = mlUserData.nickname || null;

    const expiresAt = new Date(
      Date.now() + expires_in * 1000
    ).toISOString();

    // Upsert connection (one per user)
    const { error: dbError } = await supabase
      .from("ml_connections")
      .upsert(
        {
          user_id: state,
          access_token,
          refresh_token,
          ml_user_id: String(mlUserId),
          seller_nickname: sellerNickname,
          token_expires_at: expiresAt,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (dbError) {
      console.error("DB error:", dbError);
      // Try insert if upsert fails (no unique constraint on user_id)
      const { error: insertError } = await supabase
        .from("ml_connections")
        .insert({
          user_id: state,
          access_token,
          refresh_token,
          ml_user_id: String(mlUserId),
          seller_nickname: sellerNickname,
          token_expires_at: expiresAt,
          is_active: true,
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(null, {
          status: 302,
          headers: { Location: `${appUrl}/integracao-ml?error=db_error` },
        });
      }
    }

    // Redirect back to the app
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appUrl}/integracao-ml?connected=true`,
      },
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    return new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/integracao-ml?error=server_error` },
    });
  }
});
