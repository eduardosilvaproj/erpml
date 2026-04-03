import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const ALLOWED_ROLES = new Set(["user", "assistant"]);

const SYSTEM_PROMPT = `Você é um especialista em tributação brasileira para e-commerce, com foco em vendedores do Mercado Livre.

Sua função é analisar produtos e operações e orientar a forma MAIS EFICIENTE de tributação possível, sempre dentro da lei brasileira.

⚠️ REGRAS IMPORTANTES:
- Nunca sugira alterar NCM apenas para pagar menos imposto.
- Sempre priorize conformidade fiscal.
- Quando houver dúvida, informe que é necessário validar com contador.
- Seja direto, prático e objetivo.
- Responda sempre em português brasileiro.
- Use markdown para formatar as respostas.

Quando o usuário fornecer dados de um produto, siga esta estrutura de resposta:

## 📦 Classificação Fiscal (NCM)
Sugestões de NCM (máximo 3 opções) com descrição, justificativa e nível de confiança.

## 💰 Estimativa de Carga Tributária
ICMS, PIS/COFINS, IPI e carga total estimada.

## 📊 Simulação de Regime Tributário
Compare Simples Nacional vs Lucro Presumido.

## 🧠 Análise Inteligente
Carga tributária (Alta/Média/Baixa), impacto no lucro, risco fiscal e margem após impostos.

## 🚀 Sugestões Estratégicas
Até 5 sugestões práticas.

## ⚠️ Alertas Importantes
Riscos ou pontos de atenção.

## 📌 Resumo Final
Em até 3 linhas, a melhor decisão tributária.

Se o usuário fizer perguntas gerais sobre tributação, responda de forma clara e direta sem necessariamente seguir toda a estrutura acima.`;

function validateMessages(messages: unknown): { valid: boolean; error?: string; sanitized?: Array<{ role: string; content: string }> } {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: "messages é obrigatório" };
  }

  if (messages.length > MAX_MESSAGES) {
    return { valid: false, error: `Máximo de ${MAX_MESSAGES} mensagens por requisição` };
  }

  const sanitized: Array<{ role: string; content: string }> = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") {
      return { valid: false, error: "Formato de mensagem inválido" };
    }

    const role = typeof msg.role === "string" ? msg.role : "";
    if (!ALLOWED_ROLES.has(role)) {
      return { valid: false, error: `Role inválido: ${role}. Use 'user' ou 'assistant'.` };
    }

    const content = typeof msg.content === "string" ? msg.content : "";
    if (content.length === 0) {
      return { valid: false, error: "Conteúdo da mensagem não pode ser vazio" };
    }

    sanitized.push({
      role,
      content: content.slice(0, MAX_MESSAGE_LENGTH),
    });
  }

  return { valid: true, sanitized };
}

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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const validation = validateMessages(body?.messages);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...validation.sanitized!,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", response.status);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("tax-ai error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
