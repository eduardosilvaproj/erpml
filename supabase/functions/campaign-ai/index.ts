import { makeCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";


Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = makeCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (!action || typeof action !== "string") {
      return new Response(
        JSON.stringify({ error: "action is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (action === "enrich_item") {
      const { productName, templatePrompt } = body;
      if (!productName || typeof productName !== "string" || productName.length > 500) {
        return new Response(
          JSON.stringify({ error: "productName inválido" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const systemPrompt = templatePrompt && typeof templatePrompt === "string" && templatePrompt.length <= 2000
        ? templatePrompt
        : "Você é um especialista em e-commerce brasileiro. Gere descrições vendáveis, categorias, tags e especificações técnicas para produtos.";

      const userPrompt = `Produto: "${productName}"

Gere dados completos para este produto para publicação em marketplace. Retorne APENAS dados com alta confiança.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "enrich_campaign_item",
                description: "Retorna dados enriquecidos de um produto para campanha de marketplace.",
                parameters: {
                  type: "object",
                  properties: {
                    description: {
                      type: "string",
                      description: "Descrição vendável e otimizada para marketplace (3-5 frases).",
                    },
                    category: {
                      type: "string",
                      description: "Categoria sugerida (ex: Eletrônicos, Vestuário, Casa e Decoração).",
                    },
                    tags: {
                      type: "array",
                      items: { type: "string" },
                      description: "3-8 tags relevantes para busca.",
                    },
                    specs: {
                      type: "object",
                      description: "Especificações técnicas como pares chave-valor.",
                      additionalProperties: { type: "string" },
                    },
                  },
                  required: ["description", "category", "tags"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "enrich_campaign_item" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
            { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage." }),
            { status: 402, headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
        console.error("AI gateway error:", response.status);
        return new Response(
          JSON.stringify({ error: "Erro ao consultar IA" }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      const usage = data.usage;

      if (!toolCall?.function?.arguments) {
        return new Response(
          JSON.stringify({ error: "IA não retornou dados estruturados" }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const enrichedData = JSON.parse(toolCall.function.arguments);
      const totalTokens = (usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0);

      return new Response(
        JSON.stringify({ success: true, data: enrichedData, tokens_used: totalTokens }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação não reconhecida" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("campaign-ai error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
