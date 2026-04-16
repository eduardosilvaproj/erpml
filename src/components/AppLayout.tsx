import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import SupportChat from "@/components/SupportChat";
import HelpPanel from "@/components/HelpPanel";
import { useUnansweredMLQuestionsCount } from "@/hooks/useMLNotifications";
import { MessageSquare, ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Badge } from "@/components/ui/badge";
import { GlobalSearch } from "@/components/GlobalSearch";


const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Dashboard", subtitle: "Visão geral do seu negócio" },
  "/produtos": { title: "Produtos", subtitle: "Cadastro e gestão de produtos" },
  "/kits": { title: "Kits", subtitle: "Monte kits compostos" },
  "/equipe": { title: "Equipe", subtitle: "Membros e permissões" },
  "/crm": { title: "CRM", subtitle: "Clientes e perguntas" },
  "/estoque": { title: "Estoque", subtitle: "Saldo físico e FULL" },
  "/entrada-nota": { title: "Entrada de Nota", subtitle: "Importar notas fiscais" },
  "/entrada-xml": { title: "Entrada XML", subtitle: "Importar XML de notas" },
  "/conferencia": { title: "Conferência", subtitle: "Bip de recebimento" },
  "/balanco-estoque": { title: "Balanço", subtitle: "Inventário físico" },
  "/movimentacao-full": { title: "Envio FULL", subtitle: "Transferir para FULL" },
  "/pdv": { title: "PDV", subtitle: "Ponto de venda" },
  "/campanhas": { title: "Campanhas", subtitle: "Anúncios em massa" },
  "/integracao-ml": { title: "Integração ML", subtitle: "Mercado Livre" },
  "/minha-loja": { title: "Minha Loja", subtitle: "Vitrine virtual" },
  "/painel-hub": { title: "Painel HUB", subtitle: "Relatórios e métricas" },
  "/financeiro": { title: "Financeiro", subtitle: "Cobranças e pagamentos" },
  "/ia-hub": { title: "Central de IA", subtitle: "Ferramentas inteligentes" },
  "/ia-consulta": { title: "Consulta IA", subtitle: "Consultas tributárias" },
  "/ia-concorrencia": { title: "Análise de Concorrência", subtitle: "Monitore seus concorrentes" },
  "/ia-demanda": { title: "Previsão de Demanda", subtitle: "Planeje seu estoque" },
  "/ia-preco": { title: "Preço Dinâmico", subtitle: "Otimize seus preços" },
  "/ia-descricoes": { title: "Gerador de Descrições", subtitle: "Descrições com IA" },
  "/ia-rentabilidade": { title: "Rentabilidade", subtitle: "Análise de margens" },
  "/ia-titulos": { title: "Otimizador de Títulos", subtitle: "Títulos para ML" },
  "/ia-respostas": { title: "Respostas", subtitle: "Respostas automáticas" },
  "/ia-chat": { title: "Chat IA", subtitle: "Assistente inteligente" },
  "/ia-mercado": { title: "Análise de Mercado", subtitle: "Tendências e oportunidades" },
  "/ia-ean13": { title: "Gerador EAN-13", subtitle: "Códigos de barras" },
  "/pesquisa": { title: "Pesquisa Inteligente", subtitle: "Busca de produtos e fornecedores" },
  "/mentor-vendas": { title: "Mentor de Vendas", subtitle: "Crescimento guiado" },
  "/empresa": { title: "Minha Empresa", subtitle: "Dados e configurações" },
  "/admin": { title: "Admin", subtitle: "Painel administrativo" },
  "/master-admin": { title: "Painel Master", subtitle: "Governança da plataforma" },
  "/onboarding": { title: "Onboarding", subtitle: "Configure sua empresa" },
  "/boas-vindas": { title: "Boas-vindas", subtitle: "Bem-vindo ao sistema" },
  "/upgrade": { title: "Upgrade", subtitle: "Melhore seu plano" },
};

function getPageInfo(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const prefix = Object.keys(PAGE_TITLES).find((k) => k !== "/" && pathname.startsWith(k));
  if (prefix) return PAGE_TITLES[prefix];
  return { title: "ERP System", subtitle: "Gestão Inteligente" };
}

function SwipeIndicator() {
  const { openMobile } = useSidebar();
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isMobile || dismissed) return;
    const key = "erp-swipe-hint-seen";
    const seen = localStorage.getItem(key);
    if (seen) { setDismissed(true); return; }
    const timer = setTimeout(() => setVisible(true), 1500);
    const hideTimer = setTimeout(() => {
      setVisible(false); setDismissed(true);
      localStorage.setItem(key, "1");
    }, 5500);
    return () => { clearTimeout(timer); clearTimeout(hideTimer); };
  }, [isMobile, dismissed]);

  if (!isMobile || openMobile || dismissed || !visible) return null;

  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 pointer-events-none animate-fade-in" aria-hidden="true">
      <div className="flex items-center gap-1 bg-primary/90 text-primary-foreground pl-2 pr-3 py-2.5 rounded-r-xl shadow-lg">
        <ChevronRight className="h-4 w-4" />
        <span className="text-xs font-medium whitespace-nowrap">Deslize para menu</span>
      </div>
    </div>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const unansweredCount = useUnansweredMLQuestionsCount();
  const navigate = useNavigate();
  const location = useLocation();
  const { setOpenMobile, openMobile } = useSidebar();
  const { user } = useAuth();
  const { planName } = usePlanFeatures();
  const isMobile = useIsMobile();
  const pageInfo = getPageInfo(location.pathname);

  useSwipeGesture({
    onSwipeRight: () => { if (!openMobile) setOpenMobile(true); },
    onSwipeLeft: () => { if (openMobile) setOpenMobile(false); },
  });

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 flex items-center border-b border-border/40 bg-background/90 backdrop-blur-xl px-3 sm:px-4 lg:px-6 sticky top-0 z-30 gap-2 lg:gap-3">
          {isMobile && (
            <SidebarTrigger className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors active:scale-95" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xs lg:text-sm font-bold text-foreground leading-none truncate">{pageInfo.title}</h1>
            <p className="text-[10px] lg:text-sm text-muted-foreground mt-0.5 truncate hidden sm:block">{pageInfo.subtitle}</p>
          </div>
          <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
            <GlobalSearch />
            {unansweredCount > 0 && (
              <button
                onClick={() => navigate("/crm")}
                className="relative flex items-center gap-1.5 min-h-[36px] px-2 lg:px-2.5 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-medium transition-colors active:scale-95"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{unansweredCount}</span>
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
              </button>
            )}
            
            <HelpPanel />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden md:flex items-center gap-2 pl-2 border-l border-border/30 hover:opacity-80 transition-opacity cursor-pointer">
                  <AvatarUpload size="sm" editable={false} />
                  <div className="hidden lg:flex flex-col min-w-0">
                    <span className="text-[11px] text-muted-foreground/70 truncate max-w-[120px]">{user?.email}</span>
                    {planName && (
                      <Badge variant="outline" className="w-fit text-[8px] border-primary/25 text-primary/70 bg-primary/5 mt-0.5 h-4">
                        {planName}
                      </Badge>
                    )}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleForceUpdate} className="cursor-pointer">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verificar atualizações
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 lg:p-6 xl:p-8 overflow-auto animate-fade-in">
          {children}
        </main>
      </div>
      <SwipeIndicator />
    </div>
  );
}

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
      <SupportChat />
    </SidebarProvider>
  );
};

export default AppLayout;
