import { makeCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";


function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const MAX_QUERY_LENGTH = 500;

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = makeCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return jsonResponse({ error: "Não autorizado" }, 401);
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return jsonResponse({ error: "Chave de IA não configurada" }, 500);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Requisição inválida" }, 400);
    }

    const action = typeof body.action === "string" ? body.action : "";
    if (!action) {
      return jsonResponse({ error: "Ação inválida" }, 400);
    }

    // === SEARCH: Find products and suppliers with margin calculation ===
    if (action === "search") {
      const query = typeof body.query === "string" ? body.query.slice(0, MAX_QUERY_LENGTH).trim() : "";
      if (!query) {
        return jsonResponse({ error: "Termo de busca é obrigatório" }, 400);
      }

      const prompt = `Você é um consultor especialista em e-commerce e varejo brasileiro.
O usuário está buscando: "${query}"

Analise este termo e retorne informações úteis para um lojista que quer vender este tipo de produto.
Considere: preço de custo médio no mercado, preço de venda sugerido, margem de lucro, fornecedores conhecidos no Brasil, e tendências.

IMPORTANTE: Retorne dados realistas do mercado brasileiro. Se não tiver certeza, indique o nível de confiança.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Você é um consultor de sourcing e precificação para e-commerce brasileiro." },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "product_search_results",
                description: "Retorna resultados de pesquisa de produtos com fornecedores e margens.",
                parameters: {
                  type: "object",
                  properties: {
                    products: {
                      type: "array",
                      description: "Lista de produtos encontrados (máximo 5)",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", description: "Nome do produto" },
                          description: { type: "string", description: "Descrição curta do produto" },
                          avg_cost: { type: "number", description: "Preço de custo médio em BRL" },
                          suggested_price: { type: "number", description: "Preço de venda sugerido em BRL" },
                          margin_percent: { type: "number", description: "Margem de lucro percentual estimada" },
                          category: { type: "string", description: "Categoria do produto" },
                          demand_level: { type: "string", description: "Nível de demanda: alta, média, baixa" },
                          confidence: { type: "string", description: "Nível de confiança dos dados: alta, média, baixa" },
                        },
                        required: ["name", "description", "avg_cost", "suggested_price", "margin_percent", "category", "demand_level", "confidence"],
                      },
                    },
                    suppliers: {
                      type: "array",
                      description: "Lista de fornecedores sugeridos (máximo 5)",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", description: "Nome do fornecedor" },
                          type: { type: "string", description: "Tipo: fabricante, distribuidor, importador, atacadista" },
                          location: { type: "string", description: "Localização (cidade/estado)" },
                          contact_hint: { type: "string", description: "Dica de contato ou canal de vendas" },
                          min_order: { type: "string", description: "Pedido mínimo estimado" },
                          price_range: { type: "string", description: "Faixa de preço por unidade" },
                        },
                        required: ["name", "type", "location", "contact_hint"],
                      },
                    },
                    market_insights: {
                      type: "object",
                      description: "Insights gerais do mercado",
                      properties: {
                        trend: { type: "string", description: "Tendência do mercado: crescendo, estável, em queda" },
                        seasonality: { type: "string", description: "Sazonalidade relevante" },
                        competition: { type: "string", description: "Nível de concorrência: alta, média, baixa" },
                        tip: { type: "string", description: "Dica estratégica para o vendedor" },
                      },
                      required: ["trend", "competition", "tip"],
                    },
                  },
                  required: ["products", "suppliers", "market_insights"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "product_search_results" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return jsonResponse({ error: "Limite de requisições excedido. Tente novamente." }, 429);
        if (response.status === 402) return jsonResponse({ error: "Créditos de IA esgotados." }, 402);
        return jsonResponse({ error: "Erro ao consultar IA" }, 500);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall?.function?.arguments) {
        return jsonResponse({ error: "IA não retornou dados estruturados" }, 500);
      }

      const results = JSON.parse(toolCall.function.arguments);
      return jsonResponse({ success: true, data: results });
    }

    // === TRENDING: Suggest trending/high-demand products ===
    if (action === "trending") {
      const niche = typeof body.niche === "string" ? body.niche.slice(0, 200).trim() : "";

      const prompt = niche
        ? `Sugira 6 produtos vendáveis em alta no nicho "${niche}" para e-commerce brasileiro (Mercado Livre, Shopee). Foque em itens com boa margem e alta demanda atual.`
        : `Sugira 6 produtos vendáveis em alta para e-commerce brasileiro (Mercado Livre, Shopee) em ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}. Foque em itens com boa margem e alta demanda atual.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Você é um especialista em tendências de e-commerce brasileiro." },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "trending_products",
                description: "Retorna lista de produtos em alta.",
                parameters: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          category: { type: "string" },
                          avg_cost: { type: "number" },
                          suggested_price: { type: "number" },
                          margin_percent: { type: "number" },
                          reason: { type: "string", description: "Por que está em alta" },
                          demand_level: { type: "string" },
                        },
                        required: ["name", "category", "avg_cost", "suggested_price", "margin_percent", "reason", "demand_level"],
                      },
                    },
                  },
                  required: ["items"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "trending_products" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return jsonResponse({ error: "Limite de requisições excedido." }, 429);
        if (response.status === 402) return jsonResponse({ error: "Créditos de IA esgotados." }, 402);
        return jsonResponse({ error: "Erro ao consultar IA" }, 500);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        return jsonResponse({ error: "IA não retornou dados estruturados" }, 500);
      }

      const results = JSON.parse(toolCall.function.arguments);
      return jsonResponse({ success: true, data: results });
    }

    return jsonResponse({ error: "Ação não reconhecida" }, 400);
  } catch (error) {
    console.error("product-search error:", error);
    return jsonResponse({ error: "Erro interno do servidor" }, 500);
  }
});
