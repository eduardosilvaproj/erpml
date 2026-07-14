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
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { type, productName, products, message, history, prompt } = body;

    if (!type || typeof type !== "string") {
      return new Response(JSON.stringify({ error: "type is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";
    let userPrompt = "";
    let useStreaming = false;

    switch (type) {
      case "competition": {
        if (!productName || typeof productName !== "string" || productName.length > 500) {
          return new Response(JSON.stringify({ error: "productName inválido" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        systemPrompt = `Você é um analista de mercado especialista em e-commerce brasileiro, especialmente Mercado Livre.
Analise a concorrência para o produto informado e forneça insights acionáveis.
Sempre responda em português brasileiro.`;
        userPrompt = `Analise a concorrência para o produto: "${productName}"

Forneça:
1. **Faixa de preço estimada** no Mercado Livre (mínimo, médio, máximo)
2. **Nível de concorrência** (Baixa, Média, Alta, Muito Alta)
3. **Pontos fortes** dos principais concorrentes
4. **Oportunidades** para se destacar
5. **Estratégias recomendadas** de posicionamento
6. **Palavras-chave** mais relevantes para o anúncio`;
        break;
      }

      case "demand": {
        const productList = Array.isArray(products) ? products.slice(0, 20) : [];
        if (productList.length === 0 && (!productName || typeof productName !== "string")) {
          return new Response(JSON.stringify({ error: "productName ou products é obrigatório" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        systemPrompt = `Você é um especialista em previsão de demanda e tendências de mercado para e-commerce brasileiro.
Analise padrões sazonais, tendências e projeções de demanda.
Sempre responda em português brasileiro.`;
        const items = productList.length > 0
          ? productList.map((p: string) => `- ${p}`).join("\n")
          : `- ${productName}`;
        userPrompt = `Analise a previsão de demanda para os seguintes produtos:\n${items}

Para cada produto forneça:
1. **Tendência atual** (Em alta, Estável, Em baixa)
2. **Sazonalidade** (meses de pico e de baixa)
3. **Projeção para os próximos 30 dias** (Aumento, Estável, Queda)
4. **Fatores de influência** (datas comemorativas, clima, etc.)
5. **Recomendação de estoque** (Aumentar, Manter, Reduzir)`;
        break;
      }

      case "pricing": {
        if (!productName || typeof productName !== "string" || productName.length > 500) {
          return new Response(JSON.stringify({ error: "productName inválido" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const { cost, currentPrice, category } = body;
        systemPrompt = `Você é um especialista em precificação dinâmica para e-commerce brasileiro, especialmente Mercado Livre.
Sugira preços otimizados considerando margem, concorrência e demanda.
Sempre responda em português brasileiro.`;
        userPrompt = `Sugira precificação para o produto: "${productName}"
${cost ? `Custo: R$ ${cost}` : ""}
${currentPrice ? `Preço atual: R$ ${currentPrice}` : ""}
${category ? `Categoria: ${category}` : ""}

Forneça:
1. **Preço sugerido** (valor otimizado)
2. **Faixa ideal** (mínimo e máximo)
3. **Margem estimada** considerando taxas do ML (~16-19%)
4. **Estratégia de preço** recomendada (penetração, competitivo, premium)
5. **Impacto do frete** na decisão de compra
6. **Sugestões de promoção** (desconto por quantidade, cupons)`;
        break;
      }

      case "description": {
        if (!productName || typeof productName !== "string" || productName.length > 500) {
          return new Response(JSON.stringify({ error: "productName inválido" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const { features, tone } = body;
        systemPrompt = `Você é um copywriter especialista em anúncios do Mercado Livre.
Crie descrições otimizadas para SEO, persuasivas e completas.
Sempre responda em português brasileiro.`;
        userPrompt = `Crie uma descrição otimizada para o produto: "${productName}"
${features ? `Características: ${features}` : ""}
${tone ? `Tom desejado: ${tone}` : "Tom: Profissional e persuasivo"}

Forneça:
1. **Título otimizado** para o Mercado Livre (até 60 caracteres)
2. **Descrição completa** (estruturada com seções)
3. **Bullet points** com principais benefícios (5-8 itens)
4. **Palavras-chave** para melhorar posicionamento (8-12)
5. **Ficha técnica** sugerida
6. **Dicas de foto** para o anúncio`;
        break;
      }

      case "profitability": {
        if (!productName || typeof productName !== "string" || productName.length > 500) {
          return new Response(JSON.stringify({ error: "productName inválido" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const { cost: profCost, price: profPrice, mlFees, shippingCost: profShipping } = body;
        systemPrompt = `Você é um analista financeiro especialista em e-commerce e Mercado Livre brasileiro.
Analise a rentabilidade de produtos considerando todos os custos envolvidos.
Sempre responda em português brasileiro com números precisos.`;
        userPrompt = `Analise a rentabilidade do produto: "${productName}"
${profCost ? `Custo de aquisição: R$ ${profCost}` : ""}
${profPrice ? `Preço de venda: R$ ${profPrice}` : ""}
${mlFees ? `Taxas do ML: ${mlFees}%` : "Considere taxas ML padrão (~16-19%)"}
${profShipping ? `Custo de envio: R$ ${profShipping}` : ""}

Forneça:
1. **Margem líquida estimada** (em R$ e %)
2. **Breakdown de custos** (produto, taxas ML, frete, impostos estimados)
3. **Ponto de equilíbrio** (quantidade mínima para lucrar)
4. **ROI estimado** por unidade
5. **Comparação** com margens típicas da categoria
6. **Sugestões** para melhorar a rentabilidade
7. **Simulação** de cenários (otimista, realista, pessimista)`;
        break;
      }

      case "title_optimizer": {
        if (!productName || typeof productName !== "string" || productName.length > 500) {
          return new Response(JSON.stringify({ error: "productName inválido" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        const { currentTitle, targetCategory } = body;
        systemPrompt = `Você é um especialista em SEO e otimização de títulos para o Mercado Livre.
Conheça profundamente o algoritmo de busca do ML e as melhores práticas de títulos.
Sempre responda em português brasileiro.`;
        userPrompt = `Otimize o título para o produto: "${productName}"
${currentTitle ? `Título atual: "${currentTitle}"` : ""}
${targetCategory ? `Categoria alvo: ${targetCategory}` : ""}

Forneça:
1. **5 variações de título** otimizadas (até 60 caracteres cada)
2. **Análise do título atual** (se fornecido) com pontos de melhoria
3. **Palavras-chave primárias** que devem estar no título
4. **Palavras-chave secundárias** para descrição
5. **Ordem ideal** das palavras (marca, modelo, característica, benefício)
6. **Erros comuns** a evitar
7. **Score estimado** de cada variação (1-10)`;
        break;
      }

      case "question_answer": {
        const { question, productContext } = body;
        if (!question || typeof question !== "string" || question.length > 2000) {
          return new Response(JSON.stringify({ error: "question inválida" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        systemPrompt = `Você é um vendedor experiente do Mercado Livre.
Responda perguntas de compradores de forma profissional, amigável e vendedora.
Mantenha respostas curtas (máximo 3 frases), objetivas e que incentivem a compra.
Nunca forneça informações falsas. Se não souber, diga que vai verificar.
Sempre responda em português brasileiro.`;
        userPrompt = `Pergunta do comprador: "${question}"
${productContext ? `Contexto do produto: ${productContext}` : ""}

Gere 3 opções de resposta:
1. **Resposta direta** - objetiva e profissional
2. **Resposta vendedora** - incentiva a compra
3. **Resposta detalhada** - com mais informações técnicas`;
        break;
      }

      case "market_analysis": {
        const { niche, goal } = body;
        if (!niche || typeof niche !== "string" || niche.length > 500) {
          return new Response(JSON.stringify({ error: "niche inválido" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        systemPrompt = `Você é um analista de mercado e pesquisador de fornecedores especializado em e-commerce brasileiro e Mercado Livre.
Seu objetivo é identificar oportunidades de venda reais, produtos em alta, e sempre indicar fornecedores com dados de contato.
IMPORTANTE: Para cada oportunidade ou produto sugerido, SEMPRE inclua pelo menos 2-3 fornecedores com:
- Nome da empresa/fornecedor
- Site ou marketplace onde encontrá-lo
- Tipo de contato (WhatsApp, e-mail, telefone) quando disponível
- Região/estado do fornecedor
- Faixa de preço de custo estimada
Priorize fornecedores nacionais (Brasil), mas inclua internacionais (AliExpress, 1688, Alibaba) quando relevante.
Sempre responda em português brasileiro com dados práticos e acionáveis.`;
        userPrompt = `Analise o mercado para o nicho/categoria: "${niche}"
${goal ? `Objetivo específico: ${goal}` : ""}

Forneça uma análise completa com:

## 1. 📈 Tendências Atuais
- Top 5 produtos mais vendidos neste nicho no Mercado Livre
- Variação de demanda nos últimos meses (alta/estável/queda)
- Sazonalidade relevante

## 2. 💎 Oportunidades de Venda
- 5 produtos com alto potencial e baixa concorrência
- Para cada produto: faixa de preço de venda, margem estimada e nível de concorrência
- Nichos adjacentes promissores

## 3. 🏭 Fornecedores Recomendados
Para CADA produto/oportunidade indicado, liste fornecedores com:
- **Nome** da empresa ou loja
- **Plataforma** (site próprio, Shopee, AliExpress, 1688, atacadista local)
- **Contato** (WhatsApp, e-mail, telefone, link direto)
- **Localização** (cidade/estado ou país)
- **Preço de custo estimado** por unidade
- **Quantidade mínima** de pedido (MOQ)

## 4. 💰 Análise Financeira
- Investimento inicial estimado para começar
- ROI esperado no primeiro mês
- Break-even point (ponto de equilíbrio)

## 5. 🎯 Estratégia Recomendada
- Melhor abordagem para entrar neste nicho
- Diferenciação possível (kits, embalagem, brinde)
- Erros comuns a evitar`;
        break;
      }

      case "smart_chat": {
        useStreaming = true;
        if (!message || typeof message !== "string" || message.length > 4000) {
          return new Response(JSON.stringify({ error: "message inválida" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "chat": {
        useStreaming = true;
        if (!message || typeof message !== "string" || message.length > 4000) {
          return new Response(JSON.stringify({ error: "message inválida" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "kit-suggestion": {
        if (!prompt || typeof prompt !== "string" || prompt.length > 50000) {
          return new Response(JSON.stringify({ error: "prompt inválido" }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        systemPrompt = `Você é um especialista em e-commerce que sugere kits de produtos comercialmente viáveis. Responda SEMPRE apenas com JSON válido, sem markdown, sem texto adicional.`;
        userPrompt = prompt;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Tipo de análise não reconhecido" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
    }

    if (useStreaming) {
      const chatHistory = Array.isArray(history) ? history.slice(-30) : [];
      const msgs = [
        {
          role: "system",
          content: `Você é um assistente de IA especializado em e-commerce e Mercado Livre no Brasil.
Você pode ajudar com: análise de concorrência, previsão de demanda, precificação dinâmica e criação de descrições.
Seja prático, direto e forneça dados acionáveis. Responda sempre em português brasileiro.`,
        },
        ...chatHistory.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content.slice(0, 4000) : "",
        })),
        { role: "user", content: message },
      ];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: msgs, stream: true }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
            status: 402, headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        console.error("AI gateway error:", status);
        return new Response(JSON.stringify({ error: "Erro ao consultar IA" }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      return new Response(response.body, {
        headers: { ...cors, "Content-Type": "text/event-stream" },
      });
    }

    // Non-streaming: structured analysis
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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ error: "Erro ao consultar IA" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "IA não retornou resposta" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, content }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-analysis error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
