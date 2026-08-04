import { makeCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getAiConfig, resolveModel, aiHeaders, AI_KEY_MISSING } from "../_shared/ai.ts";


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
    const validation = validateMessages(body?.messages);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const aiCfg = getAiConfig();
    if (!aiCfg) {
      return new Response(
        JSON.stringify({ error: AI_KEY_MISSING }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(aiCfg.url, {
      method: "POST",
      headers: aiHeaders(aiCfg),
      body: JSON.stringify({
        model: resolveModel("google/gemini-3-flash-preview", aiCfg.provider),
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
          { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", response.status);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar IA" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...cors, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("tax-ai error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
