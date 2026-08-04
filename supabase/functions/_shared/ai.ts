/**
 * Camada de acesso ao provider de IA.
 *
 * O gateway do Lovable (ai.gateway.lovable.dev) é um proxy compatível com a API
 * da OpenAI: aceita { model, messages, stream } em /v1/chat/completions. O Google
 * expõe um endpoint com o mesmo contrato, então trocar de provider é só trocar
 * URL + chave + nome do modelo — nenhuma mudança na forma de chamar.
 *
 * Resolução da chave, em ordem:
 *   1. GEMINI_API_KEY  -> Google direto (aistudio.google.com/apikey, tem tier grátis)
 *   2. LOVABLE_API_KEY -> gateway do Lovable (só funciona hospedado no Lovable Cloud)
 *
 * Assim as functions rodam com qualquer uma das duas, sem novo deploy ao trocar.
 */

export type AiProvider = "google" | "lovable";

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  url: string;
}

const GOOGLE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * Lê a configuração do ambiente. Retorna null quando nenhuma chave está
 * configurada — quem chama decide o erro a devolver.
 */
export function getAiConfig(): AiConfig | null {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (geminiKey) {
    return { provider: "google", apiKey: geminiKey, url: GOOGLE_URL };
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    return { provider: "lovable", apiKey: lovableKey, url: LOVABLE_URL };
  }

  return null;
}

/**
 * Normaliza o slug do modelo para o provider ativo.
 *
 * O gateway do Lovable usa slugs prefixados ("google/gemini-2.5-flash"); a API
 * do Google recebe o nome puro ("gemini-2.5-flash"). Chamar o Google com o
 * prefixo devolve 404, então a troca é obrigatória, não cosmética.
 */
export function resolveModel(model: string, provider: AiProvider): string {
  if (provider === "google") {
    return model.replace(/^google\//, "");
  }
  return model;
}

/** Headers padrão para o endpoint de chat completions. */
export function aiHeaders(cfg: AiConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
  };
}

/** Mensagem de erro única para o caso "nenhuma chave configurada". */
export const AI_KEY_MISSING =
  "Nenhuma chave de IA configurada. Defina GEMINI_API_KEY (recomendado) ou LOVABLE_API_KEY nos secrets do projeto.";
