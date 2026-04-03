import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a Ana, assistente de suporte do ERP System — um sistema de gestão para e-commerce e Mercado Livre.

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

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Chave de IA não configurada" }),
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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas perguntas ao mesmo tempo! Aguarde alguns segundos e tente de novo 😊" }),
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
        JSON.stringify({ error: "Erro ao consultar assistente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("support-ai error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
