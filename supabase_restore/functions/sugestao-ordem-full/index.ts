import { makeCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";


const CRITERIOS: Record<string, string> = {
  full_baixo: "Priorize produtos com menor estoque FULL (especialmente os zerados ou abaixo do estoque mínimo).",
  mais_vendidos: "Priorize produtos com maior volume de vendas nos últimos 30 dias.",
  equilibrar: "Priorize produtos com grande diferença entre estoque físico e estoque FULL (físico alto, FULL baixo).",
  estoque_minimo: "Selecione apenas produtos cujo estoque FULL esteja abaixo do estoque mínimo.",
};

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = makeCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { quantidade = 10, criterio = "full_baixo", category_id = null } = await req.json();

    // Buscar produtos da empresa do usuário
    let productsQuery = supabase
      .from("products")
      .select("id, name, sku, image_url, stock_physical, stock_full, min_stock, category_id")
      .eq("active", true);
    if (category_id) productsQuery = productsQuery.eq("category_id", category_id);

    const { data: products, error: pErr } = await productsQuery.limit(200);
    if (pErr) throw pErr;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ suggestions: [], explanation: "Nenhum produto encontrado." }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Vendas últimos 30 dias (sale_items + sales)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: salesItems } = await supabase
      .from("sale_items")
      .select("product_id, quantity, sales!inner(created_at)")
      .gte("sales.created_at", since);

    const sales30: Record<string, number> = {};
    (salesItems || []).forEach((s: any) => {
      sales30[s.product_id] = (sales30[s.product_id] || 0) + Number(s.quantity || 0);
    });

    // Enrichments + filtro por critério
    let enriched = products.map((p) => ({
      id: p.id, name: p.name, sku: p.sku, image_url: p.image_url,
      stock_physical: p.stock_physical, stock_full: p.stock_full, min_stock: p.min_stock,
      vendas_30d: sales30[p.id] || 0,
    }));

    if (criterio === "estoque_minimo") {
      enriched = enriched.filter((p) => p.stock_full < (p.min_stock || 0));
    }

    // Pré-ranking determinístico (top 50 candidatos para a IA)
    const rank = (p: typeof enriched[number]) => {
      switch (criterio) {
        case "mais_vendidos": return p.vendas_30d * -1;
        case "equilibrar": return (p.stock_full - p.stock_physical);
        case "full_baixo":
        default: return p.stock_full;
      }
    };
    const candidatos = [...enriched].sort((a, b) => rank(a) - rank(b)).slice(0, 50);

    if (candidatos.length === 0) {
      return new Response(JSON.stringify({ suggestions: [], explanation: "Nenhum produto atende ao critério." }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é um assistente especialista em gestão de estoque para Mercado Livre FULL.
Analise os produtos e sugira os ${quantidade} mais importantes para enviar ao FULL hoje.
Critério: ${CRITERIOS[criterio] || CRITERIOS.full_baixo}
Para cada produto, defina uma quantidade sugerida considerando:
- Vendas dos últimos 30 dias (estimar 1 mês de cobertura)
- Estoque físico disponível (não sugerir mais do que existe)
- Estoque FULL atual (quanto falta)
Forneça também uma explicação curta (1-2 frases) sobre os critérios usados.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Produtos disponíveis:\n${JSON.stringify(candidatos, null, 2)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "sugerir_produtos",
            description: "Retorna a lista de produtos sugeridos para envio FULL.",
            parameters: {
              type: "object",
              properties: {
                explanation: { type: "string", description: "Explicação curta da estratégia usada." },
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      produto_id: { type: "string" },
                      qtd_sugerida: { type: "number" },
                      motivo: { type: "string" },
                    },
                    required: ["produto_id", "qtd_sugerida", "motivo"],
                  },
                },
              },
              required: ["explanation", "suggestions"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "sugerir_produtos" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de IA atingido. Tente novamente em instantes." }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${aiResp.status} ${errText}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { suggestions: [], explanation: "" };

    // Cruzar com dados completos dos produtos
    const productMap = new Map(enriched.map((p) => [p.id, p]));
    const final = (args.suggestions || [])
      .map((s: any) => {
        const p = productMap.get(s.produto_id);
        if (!p) return null;
        return {
          ...p,
          qtd_sugerida: Math.max(1, Math.min(Number(s.qtd_sugerida) || 1, p.stock_physical || 999)),
          motivo: s.motivo,
        };
      })
      .filter(Boolean)
      .slice(0, quantidade);

    return new Response(JSON.stringify({ suggestions: final, explanation: args.explanation }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("sugestao-ordem-full error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
