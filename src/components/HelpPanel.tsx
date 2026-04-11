import { useState } from "react";
import { useHelp } from "@/contexts/HelpContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HelpCircle,
  BookOpen,
  Lightbulb,
  MessageCircleQuestion,
  ChevronDown,
  Package,
  FileText,
  ScanBarcode,
  Warehouse,
  ShoppingBag,
  Monitor,
  Users,
  BarChart3,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

interface Tutorial {
  title: string;
  icon: any;
  steps: string[];
}

interface Tip {
  title: string;
  description: string;
}

interface FAQ {
  question: string;
  answer: string;
}

const TUTORIALS: Tutorial[] = [
  {
    title: "Cadastrar um Produto",
    icon: Package,
    steps: [
      "Acesse o menu Cadastros > Produtos",
      "Clique no botão '+ Novo Produto'",
      "Preencha nome, SKU, preço de custo e venda",
      "Opcionalmente adicione código de barras, categoria e fornecedor",
      "Use o botão de enriquecimento IA para preencher automaticamente descrição e dimensões",
      "Clique em 'Salvar' para finalizar",
    ],
  },
  {
    title: "Importar Nota Fiscal XML",
    icon: FileText,
    steps: [
      "Vá em Estoque > Entrada XML",
      "Arraste o arquivo XML da nota fiscal ou clique para selecionar",
      "O sistema identifica automaticamente os itens e tenta vincular aos produtos cadastrados",
      "Revise os matches e corrija itens não vinculados",
      "Confirme a importação para atualizar o estoque",
    ],
  },
  {
    title: "Conferir Mercadorias Recebidas",
    icon: ScanBarcode,
    steps: [
      "Acesse Estoque > Conferência",
      "Selecione a nota fiscal a conferir",
      "Use a câmera ou leitor de código de barras para bipar os itens",
      "O sistema compara a quantidade escaneada com o esperado da nota",
      "Finalize a conferência para atualizar o estoque",
    ],
  },
  {
    title: "Realizar uma Venda no PDV",
    icon: Monitor,
    steps: [
      "Acesse Vendas > PDV",
      "Busque produtos por nome ou código de barras",
      "Adicione os itens ao carrinho e ajuste quantidades",
      "Selecione a forma de pagamento e aplique descontos se necessário",
      "Finalize a venda — o estoque é atualizado automaticamente",
    ],
  },
  {
    title: "Integrar com Mercado Livre",
    icon: ShoppingBag,
    steps: [
      "Vá em Vendas > Integração ML (requer plano Premium)",
      "Clique em 'Conectar conta' e autorize o acesso via Mercado Livre",
      "Vincule seus produtos locais aos anúncios do ML",
      "Ative a sincronização automática de estoque e preços",
      "Acompanhe pedidos e perguntas diretamente no sistema",
    ],
  },
  {
    title: "Gerenciar Estoque",
    icon: Warehouse,
    steps: [
      "Acesse Estoque para uma visão geral de todos os produtos",
      "Use os filtros para encontrar itens com estoque baixo",
      "Configure estoque mínimo nos produtos para receber alertas",
      "Use o Balanço para inventários periódicos",
      "O Envio FULL gerencia transferências entre estoque físico e Mercado Livre",
    ],
  },
];

const TIPS: Tip[] = [
  {
    title: "🚀 Enriquecimento por IA",
    description: "Ao cadastrar um produto, clique no ícone de IA para preencher automaticamente descrição, peso e dimensões — economiza tempo e melhora seus anúncios.",
  },
  {
    title: "📊 Monitore o Painel HUB",
    description: "O Painel HUB mostra suas métricas mais importantes (vendas, estoque, financeiro) em um só lugar. Acesse diariamente para tomar decisões rápidas.",
  },
  {
    title: "🔔 Estoque Mínimo",
    description: "Configure o estoque mínimo em cada produto. O sistema te alerta quando algum item está acabando, evitando rupturas de venda.",
  },
  {
    title: "📱 Use o Leitor de Barras",
    description: "Na conferência e no PDV, use a câmera do celular como leitor de código de barras. É mais rápido e reduz erros de digitação.",
  },
  {
    title: "🤖 Pergunte à Ana ou ao Max",
    description: "Use o chat de ajuda no canto inferior direito. A Ana responde dúvidas sobre o sistema, e o Max dá dicas de vendas no Mercado Livre.",
  },
  {
    title: "📋 Kits de Produtos",
    description: "Monte kits combinando vários produtos em um só. Ao vender o kit, o estoque de cada componente é atualizado automaticamente.",
  },
];

const FAQS: FAQ[] = [
  {
    question: "Como faço para trocar meu plano?",
    answer: "Acesse o menu 'Minha Empresa' para ver seu plano atual e opções de upgrade. Você pode alterar a qualquer momento e o sistema ajusta imediatamente suas funcionalidades disponíveis.",
  },
  {
    question: "Posso convidar mais pessoas para usar o sistema?",
    answer: "Sim! Vá em Cadastros > Equipe e convide membros por email. Defina o papel (dono, gerente ou membro) para controlar os acessos. O limite de usuários depende do seu plano.",
  },
  {
    question: "O que é estoque 'Full'?",
    answer: "Estoque Full é o estoque armazenado nos centros de distribuição do Mercado Livre. Com o envio Full, seus produtos são entregues mais rápido e ganham destaque nos anúncios. Gerencie transferências em Estoque > Envio FULL.",
  },
  {
    question: "Como funciona a conferência de notas?",
    answer: "Após importar uma nota fiscal XML, vá em Conferência para verificar os itens recebidos. Escaneie os códigos de barras e o sistema compara com o esperado, apontando divergências automaticamente.",
  },
  {
    question: "O sistema funciona no celular?",
    answer: "Sim! O ERP é um PWA (Progressive Web App) e pode ser instalado no celular como um aplicativo. Acesse pelo navegador e toque em 'Adicionar à tela inicial' para usar como app nativo.",
  },
  {
    question: "Como usar a Central de IA?",
    answer: "A Central de IA reúne várias ferramentas inteligentes: gerador de descrições, otimizador de títulos, consultor tributário, pesquisa de mercado e mais. Acesse pelo menu Inteligência > Central de IA.",
  },
  {
    question: "Perdi minha senha, como recuperar?",
    answer: "Na tela de login, clique em 'Esqueci a senha'. Informe seu email e enviaremos um link para criar uma nova senha. O link é válido por tempo limitado.",
  },
  {
    question: "Meus dados estão seguros?",
    answer: "Sim. Usamos criptografia em trânsito (HTTPS), políticas de segurança por linha (RLS) no banco de dados, e cada empresa só acessa seus próprios dados. Senhas são armazenadas com hash seguro.",
  },
];

function FAQItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-start gap-2 w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group">
        <MessageCircleQuestion className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1">{faq.question}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 mt-0.5 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="px-3 pb-2 pl-9">
          <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TutorialItem({ tutorial }: { tutorial: Tutorial }) {
  const [open, setOpen] = useState(false);
  const Icon = tutorial.icon;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-medium text-foreground flex-1">{tutorial.title}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="px-3 pb-2 pl-12">
          <ol className="space-y-1.5">
            {tutorial.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

type Tab = "tutorials" | "tips" | "faq" | "settings";

export default function HelpPanel() {
  const { helpEnabled, setHelpEnabled } = useHelp();
  const [tab, setTab] = useState<Tab>("tutorials");

  if (!helpEnabled) return null;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "tutorials", label: "Tutoriais", icon: BookOpen },
    { id: "tips", label: "Dicas", icon: Lightbulb },
    { id: "faq", label: "FAQ", icon: MessageCircleQuestion },
    { id: "settings", label: "", icon: Settings },
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 relative"
          title="Ajuda e tutoriais"
        >
          <HelpCircle className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[420px] max-w-[100vw] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3">
          <SheetTitle className="flex items-center gap-2.5 text-lg">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            Central de Ajuda
          </SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b px-5 gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                } ${t.id === "settings" ? "ml-auto" : ""}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {tab === "tutorials" && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground mb-3 px-3">
                  Siga os passos abaixo para aprender cada funcionalidade do sistema.
                </p>
                {TUTORIALS.map((t, i) => (
                  <TutorialItem key={i} tutorial={t} />
                ))}
              </div>
            )}

            {tab === "tips" && (
              <div className="space-y-3 px-1">
                <p className="text-xs text-muted-foreground mb-3 px-2">
                  Dicas práticas para aproveitar ao máximo o sistema.
                </p>
                {TIPS.map((tip, i) => (
                  <div key={i} className="p-3 rounded-xl bg-muted/40 border border-border/50">
                    <p className="text-sm font-medium text-foreground mb-1">{tip.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tip.description}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "faq" && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground mb-3 px-3">
                  Respostas rápidas para as perguntas mais comuns.
                </p>
                {FAQS.map((faq, i) => (
                  <FAQItem key={i} faq={faq} />
                ))}
              </div>
            )}

            {tab === "settings" && (
              <div className="space-y-5 px-1">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Configurações de Ajuda</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Personalize como a ajuda aparece na interface.
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                  <div className="space-y-1">
                    <Label htmlFor="help-toggle" className="text-sm font-medium cursor-pointer">
                      Exibir botão de ajuda
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Mostra o ícone de ajuda no cabeçalho de todas as telas
                    </p>
                  </div>
                  <Switch
                    id="help-toggle"
                    checked={helpEnabled}
                    onCheckedChange={setHelpEnabled}
                  />
                </div>
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    💡 Se desabilitar a ajuda, você pode reativá-la a qualquer momento acessando <strong>Minha Empresa</strong> ou limpando os dados do navegador.
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
