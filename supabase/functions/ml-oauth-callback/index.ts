import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

  if (!APP_ID || !CLIENT_SECRET) {
    return new Response("ML credentials not configured", { status: 500 });
  }

  const redirectUri = `${SUPABASE_URL}/functions/v1/ml-oauth-callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: APP_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("ML token error:", tokenData);
      const appUrl = Deno.env.get("APP_URL") || "https://erpml.lovable.app";
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
    const userData = await userRes.json();
    const sellerNickname = userData.nickname || null;

    const expiresAt = new Date(
      Date.now() + expires_in * 1000
    ).toISOString();

    // Save to database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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
        return new Response(`Database error: ${insertError.message}`, {
          status: 500,
        });
      }
    }

    // Redirect back to the app
    const appUrl = Deno.env.get("APP_URL") || "https://erpml.lovable.app";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appUrl}/integracao-ml?connected=true`,
      },
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
});
