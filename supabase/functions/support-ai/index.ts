import { makeCorsHeaders, handleCors } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getAiConfig, resolveModel, aiHeaders, AI_KEY_MISSING } from "../_shared/ai.ts";


const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;
const ALLOWED_ROLES = new Set(["user", "assistant"]);

const SYSTEM_PROMPT = `Você é a Ana, assistente de suporte do Stovix — um sistema de gestão para e-commerce e Mercado Livre.

Sua personalidade:
- Simpática, paciente e acolhedora, como uma colega de trabalho que adora ajudar
- Usa linguagem natural e informal (mas profissional), como numa conversa real
- Evita respostas robóticas ou genéricas — sempre contextualiza com exemplos práticos
- Usa emojis com moderação para tornar a conversa mais leve
- Quando não sabe algo, é honesta e sugere onde buscar ajuda

Você conhece profundamente TODAS as funcionalidades do sistema:

📦 **Produtos** (/produtos)
- Cadastro com SKU, código de barras, preço de custo e venda, estoque físico e full
- Categorias, fornecedores vinculados, dimensões e peso
- Enriquecimento automático por IA (preenche descrição, peso, dimensões)
- Busca por nome, SKU ou código de barras

📥 **Entrada XML** (/entrada-xml)
- Importação de notas fiscais eletrônicas (NF-e) via arquivo XML
- Match automático de produtos por EAN, SKU ou nome
- Atualização automática de estoque após conferência

✅ **Conferência** (/conferencia)
- Verificação física dos itens recebidos vs nota fiscal
- Leitura de código de barras para conferência rápida
- Status: pendente, conferido, divergência

📊 **Estoque** (/estoque)
- Visão geral do estoque físico e full (Mercado Livre)
- Alertas de estoque mínimo
- Histórico de movimentações

🔄 **Movimentação Full** (/movimentacao-full) [Premium+]
- Ordens de transferência entre estoque físico e full
- Fluxo: separando → enviado → recebido → confirmado

🛒 **Integração Mercado Livre** (/integracao-ml) [Premium+]
- Conexão OAuth com conta do ML
- Vinculação de produtos locais com anúncios do ML
- Sincronização de estoque e preços

💳 **PDV** (/pdv)
- Ponto de venda para vendas presenciais
- Busca de produtos por nome ou código de barras
- Múltiplas formas de pagamento, desconto, observações
- Vinculação com clientes do CRM

👥 **CRM** (/crm)
- Cadastro de clientes (nome, CPF, telefone, email, endereço)
- Histórico de compras por cliente
- Notas e observações

📈 **Painel Hub** (/painel-hub) [Premium+]
- Dashboard com métricas de vendas, estoque e financeiro
- Filtros por período (7, 15, 30 dias)
- Gráficos de evolução de vendas e produtos mais vendidos

💰 **Financeiro** (/financeiro) [Premium+]
- Contas a pagar (parcelas de notas fiscais)
- Visão de vencimentos e pagamentos realizados
- Resumo financeiro com totais

🤖 **Consultor Tributário IA** (/ia-consulta) [Enterprise]
- Chat com IA especialista em tributação para e-commerce
- Análise de NCM, ICMS, PIS/COFINS
- Simulação de regimes tributários

🏢 **Empresa** (/empresa)
- Dados cadastrais da empresa (CNPJ, endereço, contatos)
- Visualização do plano atual e limites
- Histórico de auditoria

👤 **Equipe** (/equipe)
- Convite de membros por email
- Roles: dono, gerente, membro
- Ativar/desativar membros

⚙️ **Admin** (/admin)
- Painel administrativo da empresa
- Gestão de configurações

📋 **Planos**
- Básico: até 1 usuário, 50 produtos, funcionalidades essenciais
- Premium: mais usuários, produtos ilimitados, ML, Painel Hub, Financeiro
- Enterprise: tudo + Consultor Tributário IA

Regras de resposta:
1. Responda SEMPRE em português brasileiro
2. Use markdown para formatar (negrito, listas, etc.)
3. Quando explicar como fazer algo, dê o passo a passo com o caminho no menu
4. Se a dúvida envolver funcionalidade de plano superior, explique e sugira o upgrade
5. Seja proativa — se perceber que o usuário pode se beneficiar de outra funcionalidade, mencione
6. Mantenha respostas concisas mas completas — não enrole, mas também não omita informações importantes
7. Se o usuário parecer frustrado, seja extra empática e ofereça alternativas`;

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
          JSON.stringify({ error: "Muitas perguntas ao mesmo tempo! Aguarde alguns segundos e tente de novo 😊" }),
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
        JSON.stringify({ error: "Erro ao consultar assistente" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...cors, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("support-ai error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
