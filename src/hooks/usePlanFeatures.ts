import { useMyCompany } from "@/hooks/useCompanyData";
import { useMemo } from "react";

/**
 * Maps sidebar route paths to the plan feature strings that grant access.
 * Items not listed here are available on ALL plans.
 */
const FEATURE_GATE: Record<string, string[]> = {
  "/integracao-ml": ["Integração Mercado Livre"],
  "/movimentacao-full": ["Envio FULL"],
  "/painel-hub": ["Painel HUB"],
  "/ia-consulta": ["IA Tributária"],
  "/ia-concorrencia": ["IA Tributária"],
  "/ia-demanda": ["IA Tributária"],
  "/ia-preco": ["IA Tributária"],
  "/financeiro": ["Financeiro avançado"],
  "/ia-rentabilidade": ["IA Tributária"],
  "/ia-chat": ["IA Tributária"],
};

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
    // "Tudo do Básico" / "Tudo do Premium" inherit everything
    const hasTudoBasico = features.some((f) => f.startsWith("Tudo do"));
    if (hasTudoBasico && required.every((r) => isInheritedFeature(r, features))) return true;
    return required.some((r) => features.includes(r));
  };

  return { features, isRouteAllowed, isLoading, planName: company?.plan?.name };
}

/** Features that are inherited through "Tudo do X" chains */
function isInheritedFeature(feature: string, planFeatures: string[]): boolean {
  // If directly present
  if (planFeatures.includes(feature)) return true;
  // "Tudo do Premium" inherits premium features which include ML, FULL, HUB, IA, Financeiro
  if (planFeatures.includes("Tudo do Premium")) return true;
  if (planFeatures.includes("Tudo do Básico")) {
    // Basic features don't include ML/FULL/HUB/IA/Financeiro avançado
    return false;
  }
  return false;
}
