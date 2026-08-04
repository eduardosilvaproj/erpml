import { useMyCompany } from "@/hooks/useCompanyData";
import { useMemo } from "react";

/**
 * Maps sidebar route paths to the plan feature strings that grant access.
 * Items not listed here are available on ALL plans.
 *
 * - Básico: funcionalidades essenciais gratuitas
 * - Premium: marketplace, financeiro, campanhas, relatórios, suporte prioritário
 * - Enterprise: TUDO + todos os recursos de IA
 */
const PREMIUM_ROUTES = new Set([
  "/integracao-ml", "/movimentacao-full", "/painel-hub", "/financeiro", "/mentor-vendas",
  "/duplicador-anuncios", "/campanhas",
]);

const ENTERPRISE_ROUTES = new Set([
  "/ia-consulta", "/ia-concorrencia", "/ia-demanda", "/ia-preco",
  "/ia-rentabilidade", "/ia-chat", "/ia-mercado", "/ia-hub",
]);

const FEATURE_GATE: Record<string, string[]> = {
  // Premium gates
  "/integracao-ml": ["Integração Mercado Livre", "Todas Pro", "Tudo do Premium"],
  "/movimentacao-full": ["Envio FULL", "Todas Pro", "Tudo do Premium"],
  "/duplicador-anuncios": ["Duplicador de Anúncios", "Todas Pro", "Tudo do Premium"],
  "/campanhas": ["Campanhas de Anúncios", "Todas Pro", "Tudo do Premium"],
  "/painel-hub": ["Painel HUB", "Todas Pro", "Tudo do Premium"],
  "/financeiro": ["Financeiro avançado", "Todas Pro", "Tudo do Premium"],
  "/mentor-vendas": ["Mentor de Vendas ML", "Todas Pro", "Tudo do Premium"],
  // Enterprise gates (IA features)
  "/ia-hub": ["Central de IA", "SaaS Enterprise"],
  "/ia-consulta": ["IA Tributária", "SaaS Enterprise"],
  "/ia-concorrencia": ["Análise de Concorrência IA", "SaaS Enterprise"],
  "/ia-demanda": ["Previsão de Demanda IA", "SaaS Enterprise"],
  "/ia-preco": ["Preço Dinâmico IA", "SaaS Enterprise"],
  "/ia-rentabilidade": ["Análise de Rentabilidade IA", "SaaS Enterprise"],
  "/ia-chat": ["Chat com IA", "SaaS Enterprise"],
  "/ia-mercado": ["Análise de Mercado IA", "SaaS Enterprise"],
};

/**
 * TEMPORÁRIO (03/08/2026) — desliga os gates de plano enquanto o sistema é
 * finalizado. Com true, toda rota é liberada para qualquer plano.
 *
 * Não mexe em cobrança nem em dado: os planos continuam cadastrados e as
 * empresas seguem com o plan_id atual. Só a checagem de acesso é ignorada.
 *
 * Para reativar: mude para false (ou apague esta const e o if em isRouteAllowed).
 */
const PLAN_GATES_DISABLED = true;

/** Returns the minimum plan name required for a given route */
export function getRequiredPlan(path: string): string | null {
  if (ENTERPRISE_ROUTES.has(path)) return "Enterprise";
  if (PREMIUM_ROUTES.has(path)) return "Premium";
  return null;
}

export function usePlanFeatures() {
  const { data: company, isLoading } = useMyCompany();

  const features = useMemo(() => {
    if (!company?.plan?.features) return [] as string[];
    return company.plan.features;
  }, [company?.plan?.features]);

  /** Check if a specific sidebar route is allowed by the current plan */
  const isRouteAllowed = (path: string): boolean => {
    // TEMPORÁRIO — libera todos os módulos enquanto o sistema é finalizado.
    // Para reativar os gates de plano: apague este if e a const acima.
    if (PLAN_GATES_DISABLED) return true;

    // Get lowercased plan name and slug for robust comparison
    const currentPlanName = (company?.plan?.name || "").toLowerCase();
    const currentPlanSlug = (company?.plan?.slug || "").toLowerCase();

    // 1. Enterprise sempre tem acesso a tudo (Gate Master)
    const isEnterprise = currentPlanName.includes("enterprise") || 
                         currentPlanSlug.includes("enterprise");

    if (isEnterprise) return true;

    // Se for rota de IA e não for Enterprise, bloqueia
    if (ENTERPRISE_ROUTES.has(path) && !isEnterprise) return false;

    const required = FEATURE_GATE[path];
    if (!required) return true; // no gate = always allowed

    // 2. Pro/Premium tem acesso às rotas Premium
    const isPremium = currentPlanName.includes("pro") || 
                      currentPlanName.includes("premium") || 
                      currentPlanSlug.includes("premium") ||
                      currentPlanSlug.includes("pro");

    if (isPremium && PREMIUM_ROUTES.has(path)) return true;

    // 3. Verificação direta de features no array do plano (definido no banco)
    if (required.some((r) => features.includes(r))) return true;

    // 4. Verificação de herança de features (strings coringas para legibilidade no banco)
    if (features.includes("Tudo do Premium") || features.includes("Tudo do Pro")) return true;
    if (features.includes("Todas Pro") || features.includes("Todas Premium")) return true;
    if (features.includes("Todas Starter") && PREMIUM_ROUTES.has(path)) return true;

    return false;
  };

  return { features, isRouteAllowed, isLoading, planName: company?.plan?.name };
}
