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
]);

const ENTERPRISE_ROUTES = new Set([
  "/ia-consulta", "/ia-concorrencia", "/ia-demanda", "/ia-preco",
  "/ia-rentabilidade", "/ia-chat", "/ia-mercado",
]);

const FEATURE_GATE: Record<string, string[]> = {
  // Premium gates
  "/integracao-ml": ["Integração Mercado Livre"],
  "/movimentacao-full": ["Envio FULL"],
  "/painel-hub": ["Painel HUB"],
  "/financeiro": ["Financeiro avançado"],
  "/mentor-vendas": ["Mentor de Vendas ML"],
  // Enterprise gates (IA features)
  "/ia-consulta": ["IA Tributária"],
  "/ia-concorrencia": ["Análise de Concorrência IA"],
  "/ia-demanda": ["Previsão de Demanda IA"],
  "/ia-preco": ["Preço Dinâmico IA"],
  "/ia-rentabilidade": ["Análise de Rentabilidade IA"],
  "/ia-chat": ["Chat com IA"],
  "/ia-mercado": ["Análise de Mercado IA"],
};

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
    const required = FEATURE_GATE[path];
    if (!required) return true; // no gate = always allowed
    // Direct feature match
    if (required.some((r) => features.includes(r))) return true;
    // "Tudo do Premium" inherits all Premium features (which includes Básico)
    if (features.includes("Tudo do Premium")) return true;
    // "Tudo do Básico" only inherits basic features (not ML/FULL/HUB/IA/Financeiro)
    if (features.includes("Tudo do Básico")) return false;
    return false;
  };

  return { features, isRouteAllowed, isLoading, planName: company?.plan?.name };
}
