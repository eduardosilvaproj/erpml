import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Search, Megaphone, MessageSquare, Brain,
  Lock, ArrowRight, Crown, Zap, TrendingUp, FileText,
  ShieldCheck, Bot, Swords, DollarSign, PieChart, Type, HelpCircle, BarChart3,
  Barcode
} from "lucide-react";

type AIFeature = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  planGate: string | null; // null = available to all
  category: "consulta" | "operacional" | "pesquisa";
  tags: string[];
};

const AI_FEATURES: AIFeature[] = [
  {
    id: "tax-ai",
    title: "Consultor Tributário IA",
    description: "Tire dúvidas sobre NCM, impostos, regimes tributários e tributação para e-commerce e Mercado Livre.",
    icon: FileText,
    route: "/ia-consulta",
    planGate: "IA Tributária",
    category: "consulta",
    tags: ["Tributação", "NCM", "Impostos"],
  },
  {
    id: "concorrencia",
    title: "Análise de Concorrência",
    description: "IA analisa preços, posicionamento e estratégias dos concorrentes no Mercado Livre para seus produtos.",
    icon: Swords,
    route: "/ia-concorrencia",
    planGate: "IA Tributária",
    category: "pesquisa",
    tags: ["Concorrentes", "Preços", "Estratégia"],
  },
  {
    id: "demanda",
    title: "Previsão de Demanda",
    description: "IA prevê quais produtos terão mais demanda nos próximos dias e semanas com base em tendências.",
    icon: TrendingUp,
    route: "/ia-demanda",
    planGate: "IA Tributária",
    category: "pesquisa",
    tags: ["Tendências", "Sazonalidade", "Estoque"],
  },
  {
    id: "mercado",
    title: "Análise de Mercado",
    description: "Pesquise tendências, produtos mais vendidos e oportunidades com contato direto de fornecedores.",
    icon: BarChart3,
    route: "/ia-mercado",
    planGate: "IA Tributária",
    category: "pesquisa",
    tags: ["Tendências", "Fornecedores", "Oportunidades"],
  },
  {
    id: "pricing",
    title: "Preço Dinâmico",
    description: "IA sugere preços otimizados para maximizar lucro considerando concorrência, margem e demanda.",
    icon: DollarSign,
    route: "/ia-preco",
    planGate: "IA Tributária",
    category: "operacional",
    tags: ["Precificação", "Margem", "Otimização"],
  },
  {
    id: "descricoes",
    title: "Gerador de Descrições",
    description: "IA gera descrições otimizadas para anúncios do Mercado Livre com SEO e palavras-chave relevantes.",
    icon: FileText,
    route: "/ia-descricoes",
    planGate: null,
    category: "operacional",
    tags: ["Copywriting", "SEO", "Anúncios"],
  },
  {
    id: "rentabilidade",
    title: "Análise de Rentabilidade",
    description: "IA calcula margem líquida, ROI, ponto de equilíbrio e simula cenários de lucro para seus produtos.",
    icon: PieChart,
    route: "/ia-rentabilidade",
    planGate: "IA Tributária",
    category: "pesquisa",
    tags: ["Margem", "ROI", "Custos"],
  },
  {
    id: "titulos",
    title: "Otimizador de Títulos",
    description: "IA cria títulos otimizados com SEO e palavras-chave para melhorar o posicionamento dos seus anúncios.",
    icon: Type,
    route: "/ia-titulos",
    planGate: null,
    category: "operacional",
    tags: ["SEO", "Títulos", "Palavras-chave"],
  },
  {
    id: "respostas",
    title: "Resposta de Perguntas",
    description: "IA gera respostas profissionais para perguntas de compradores no Mercado Livre com tom vendedor.",
    icon: HelpCircle,
    route: "/ia-respostas",
    planGate: null,
    category: "operacional",
    tags: ["Perguntas", "Respostas", "Atendimento"],
  },
  {
    id: "chat-ia",
    title: "Chat IA",
    description: "Converse livremente com a IA sobre concorrência, preços, demanda e estratégias de e-commerce.",
    icon: MessageSquare,
    route: "/ia-chat",
    planGate: "IA Tributária",
    category: "consulta",
    tags: ["Chat", "Estratégia", "Livre"],
  },
  {
    id: "pesquisa",
    title: "Pesquisa Inteligente",
    description: "Pesquise produtos, fornecedores e nichos com análise de margem de lucro e tendências de mercado via IA.",
    icon: Search,
    route: "/pesquisa",
    planGate: null,
    category: "pesquisa",
    tags: ["Produtos", "Fornecedores", "Margem"],
  },
  {
    id: "ean13",
    title: "Gerador EAN-13",
    description: "Gere códigos de barras EAN-13 válidos em massa com dígito verificador, copie ou exporte em CSV.",
    icon: Barcode,
    route: "/ia-ean13",
    planGate: null,
    category: "operacional",
    tags: ["EAN-13", "Código de Barras", "Utilidade"],
  },
  {
    id: "campanhas",
    title: "Campanhas com IA",
    description: "Gere descrições otimizadas, categorize produtos e crie anúncios em massa usando inteligência artificial.",
    icon: Megaphone,
    route: "/campanhas",
    planGate: null,
    category: "operacional",
    tags: ["Anúncios", "Descrições", "Automação"],
  },
  {
    id: "suporte",
    title: "Assistente Ana",
    description: "Chat com a assistente virtual do sistema para tirar dúvidas sobre funcionalidades, configurações e fluxos.",
    icon: Bot,
    route: "#suporte",
    planGate: null,
    category: "consulta",
    tags: ["Suporte", "Dúvidas", "Chat"],
  },
];

const CATEGORIES = {
  consulta: { label: "Consulta & Suporte", icon: Brain, color: "text-blue-500" },
  operacional: { label: "Operacional & Automação", icon: Zap, color: "text-amber-500" },
  pesquisa: { label: "Pesquisa & Mercado", icon: TrendingUp, color: "text-emerald-500" },
};

export default function IAHub() {
  const navigate = useNavigate();
  const { isRouteAllowed, planName, features } = usePlanFeatures();

  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<"todos" | "premium" | "gratuito">("todos");

  const isFeatureAllowed = (feature: AIFeature): boolean => {
    if (!feature.planGate) return true;
    return features.includes(feature.planGate) ||
      features.includes("Tudo do Premium") ||
      features.some((f) => f.startsWith("Tudo do"));
  };

  const filteredFeatures = useMemo(() => {
    return AI_FEATURES.filter((f) => {
      if (tagFilter === "premium" && !f.planGate) return false;
      if (tagFilter === "gratuito" && f.planGate) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.tags.some((t) => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [searchQuery, tagFilter]);

  const handleNavigate = (feature: AIFeature) => {
    if (feature.route === "#suporte") {
      // Trigger the floating support chat
      const chatBtn = document.querySelector<HTMLButtonElement>('[data-support-chat-trigger]');
      if (chatBtn) chatBtn.click();
      return;
    }
    navigate(feature.route);
  };

  const groupedFeatures = Object.entries(CATEGORIES).map(([key, cat]) => ({
    key,
    ...cat,
    features: AI_FEATURES.filter((f) => f.category === key),
  })).filter((g) => g.features.length > 0);

  const totalAvailable = AI_FEATURES.filter(isFeatureAllowed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            Central de IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Todas as funcionalidades de inteligência artificial do sistema em um só lugar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5 gap-1">
            <ShieldCheck className="h-3 w-3" />
            {totalAvailable}/{AI_FEATURES.length} disponíveis
          </Badge>
          {planName && (
            <Badge variant="outline" className="text-xs gap-1">
              <Crown className="h-3 w-3" />
              {planName}
            </Badge>
          )}
        </div>
      </div>

      {/* Categories */}
      {groupedFeatures.map((group) => (
        <div key={group.key} className="space-y-3">
          <div className="flex items-center gap-2">
            <group.icon className={`h-5 w-5 ${group.color}`} />
            <h2 className="text-lg font-semibold">{group.label}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {group.features.map((feature) => {
              const allowed = isFeatureAllowed(feature);

              return (
                <Card
                  key={feature.id}
                  className={`relative overflow-hidden transition-all duration-200 ${
                    allowed
                      ? "hover:shadow-md hover:border-primary/30 cursor-pointer group"
                      : "opacity-60 cursor-not-allowed"
                  }`}
                  onClick={() => allowed && handleNavigate(feature)}
                >
                  {!allowed && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <Lock className="h-6 w-6 text-muted-foreground/50" />
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/upgrade");
                          }}
                        >
                          <Crown className="h-3 w-3 mr-1" />
                          Fazer Upgrade
                        </Button>
                      </div>
                    </div>
                  )}

                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      {allowed && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {feature.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {feature.planGate && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-amber-300/50 text-amber-600 bg-amber-50 dark:bg-amber-950/20"
                        >
                          Premium
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer tip */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4 flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong>Dica:</strong> A assistente Ana está sempre disponível pelo botão flutuante no canto inferior direito.
            Use-a para dúvidas rápidas sobre o sistema a qualquer momento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
