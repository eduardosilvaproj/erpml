import { makeCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = makeCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const unsplashKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
    if (!unsplashKey) {
      return new Response(JSON.stringify({ error: "Unsplash API key not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const query = url.searchParams.get("query");
    if (!query || query.trim().length === 0 || query.length > 200) {
      return new Response(JSON.stringify({ error: "Invalid query parameter" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const perPage = Math.min(Number(url.searchParams.get("per_page") || "6"), 12);

    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query.trim())}&per_page=${perPage}&orientation=squarish`,
      { headers: { Authorization: `Client-ID ${unsplashKey}` } }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Unsplash API error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Failed to search photos" }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const photos = (data.results || []).map((p: any) => ({
      id: p.id,
      url_small: p.urls?.small,
      url_regular: p.urls?.regular,
      alt: p.alt_description || p.description || "",
      photographer: p.user?.name || "",
    }));

    return new Response(JSON.stringify({ photos }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("unsplash-search error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
