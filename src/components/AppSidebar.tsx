import { useState } from "react";
import {
  Home, Package, Warehouse, Store, TrendingUp, Brain,
  LogOut, ShieldCheck, Crown, ChevronDown, Boxes, UsersRound,
  Users, ClipboardList, ScanBarcode, Monitor, Megaphone,
  Building2, BarChart3, ShoppingBag, BarChart, DollarSign, Copy, ArrowRightLeft
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, usePendingUsers } from "@/hooks/useAdminData";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { VersionBadge } from "@/components/VersionBadge";

// Re-export types and data for backward compat
export type { MenuItem, MenuGroup } from "@/lib/menu-data";
export { menuGroups } from "@/lib/menu-data";

interface SubItem { label: string; url: string; icon: any; tooltip: string; }
interface NavGroup { label: string; icon: any; color: string; tooltip: string; subItems: SubItem[]; }

const groups: NavGroup[] = [
  {
    label: "Cadastros", icon: Package, color: "text-[#60A5FA]",
    tooltip: "Gerencie produtos, kits, equipe e clientes",
    subItems: [
      { label: "Produtos", url: "/produtos", icon: Package, tooltip: "Cadastre e gerencie os produtos que você vende" },
      { label: "Kits", url: "/kits", icon: Boxes, tooltip: "Combine produtos em kits para vender juntos" },
      { label: "Equipe", url: "/equipe", icon: UsersRound, tooltip: "Adicione colaboradores e defina o que cada um pode acessar" },
      { label: "Clientes", url: "/crm", icon: Users, tooltip: "Base de clientes e histórico de compras" },
    ],
  },
  {
    label: "Estoque", icon: Warehouse, color: "text-[#34D399]",
    tooltip: "Controle entradas, saídas e conferência de estoque",
    subItems: [
      { label: "Ver Estoque", url: "/estoque", icon: Warehouse, tooltip: "Veja as quantidades disponíveis de cada produto" },
      { label: "Entrada de Nota", url: "/entrada-nota", icon: ClipboardList, tooltip: "Receba mercadorias e atualize o estoque automaticamente" },
      { label: "Conferência", url: "/conferencia", icon: ScanBarcode, tooltip: "Bipe produtos para verificar se o estoque está correto" },
      { label: "Balanço", url: "/balanco-estoque", icon: BarChart, tooltip: "Realize inventário físico do estoque" },
      { label: "Envio FULL", url: "/movimentacao-full", icon: ArrowRightLeft, tooltip: "Transferir mercadorias para o FULL do Mercado Livre" },
    ],
  },
  {
    label: "Vendas", icon: Store, color: "text-[#FB923C]",
    tooltip: "PDV, campanhas e integrações com marketplaces",
    subItems: [
      { label: "PDV", url: "/pdv", icon: Monitor, tooltip: "Registre vendas no balcão com ou sem leitor de código de barras" },
      { label: "Campanhas", url: "/campanhas", icon: Megaphone, tooltip: "Crie promoções e descontos para seus produtos" },
      { label: "Minha Loja", url: "/minha-loja/configurar", icon: Store, tooltip: "Configure sua vitrine virtual" },
      { label: "Integrações", url: "/integracao-ml", icon: ShoppingBag, tooltip: "Conecte sua conta do Mercado Livre ao sistema" },
      { label: "Duplicador ML", url: "/duplicador-anuncios", icon: Copy, tooltip: "Duplique anúncios com variações automáticas" },
    ],
  },
  {
    label: "Gestão", icon: TrendingUp, color: "text-[#A78BFA]",
    tooltip: "Relatórios, empresa e configurações do sistema",
    subItems: [
      { label: "Minha Empresa", url: "/empresa", icon: Building2, tooltip: "Dados e configurações da sua empresa" },
      { label: "Relatórios", url: "/painel-hub", icon: BarChart3, tooltip: "Métricas e relatórios de desempenho" },
      { label: "Financeiro", url: "/financeiro", icon: DollarSign, tooltip: "Cobranças, pagamentos e faturamento" },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: pendingUsers } = usePendingUsers(!!isAdmin);
  const pendingCount = isAdmin ? (pendingUsers?.length || 0) : 0;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { openMobile, setOpenMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const toggleGroup = (label: string) => {
    setOpenGroup(openGroup === label ? null : label);
  };

  const go = (url: string) => {
    navigate(url);
    if (isMobile) setOpenMobile(false);
  };

  // Mobile: overlay sidebar
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {openMobile && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpenMobile(false)}
          />
        )}
        <aside
          className={`fixed top-0 left-0 z-50 h-screen w-[260px] border-r border-border/40 bg-sidebar flex flex-col overflow-hidden transition-transform duration-300 ${
            openMobile ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarContent
            isActive={isActive}
            toggleGroup={toggleGroup}
            openGroup={openGroup}
            setOpenGroup={setOpenGroup}
            go={go}
            signOut={signOut}
            isAdmin={!!isAdmin}
            pendingCount={pendingCount}
            compact={isCollapsed}
          />
        </aside>
      </>
    );
  }

  // Tablet & Desktop
  return (
    <aside className="w-[230px] min-w-[230px] lg:w-[230px] lg:min-w-[230px] md:w-[170px] md:min-w-[170px] h-screen sticky top-0 border-r border-border/40 bg-sidebar flex flex-col overflow-hidden">
      <SidebarContent
        isActive={isActive}
        toggleGroup={toggleGroup}
        openGroup={openGroup}
        setOpenGroup={setOpenGroup}
        go={go}
        signOut={signOut}
        isAdmin={!!isAdmin}
        pendingCount={pendingCount}
        compact={isCollapsed}
      />
    </aside>
  );
}

function SidebarContent({
  isActive, toggleGroup, openGroup, setOpenGroup, go, signOut, isAdmin, pendingCount, compact,
}: {
  isActive: (url: string) => boolean;
  toggleGroup: (label: string) => void;
  openGroup: string | null;
  setOpenGroup: (g: string | null) => void;
  go: (url: string) => void;
  signOut: () => void;
  isAdmin: boolean;
  pendingCount: number;
  compact: boolean;
}) {
  return (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 border-b border-border/30 shrink-0 ${compact ? 'h-16 justify-center' : 'h-14'}`}>
        {compact ? (
          <img 
            src="/chatgpt-image.png" 
            alt="S" 
            style={{height: '32px', width: '32px', objectFit: 'contain', objectPosition: 'top center'}} 
          />
        ) : (
          <img 
            src="/chatgpt-image.png" 
            alt="Stovix" 
            style={{height: '48px', objectFit: 'contain'}} 
          />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-1.5 lg:space-y-2 scrollbar-thin">
        {/* Início */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { setOpenGroup(null); go("/"); }}
              className={`w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl text-xs lg:text-[13px] font-medium transition-all duration-150 ${
                isActive("/")
                  ? "bg-primary/20 border-l-[3px] border-primary text-foreground"
                  : "bg-slate-700/50 border-l-[3px] border-transparent text-muted-foreground hover:bg-slate-600/50 hover:text-foreground"
              }`}
            >
              <Home className="h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 text-foreground" strokeWidth={1.75} />
              <span className="truncate">Início</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Voltar para o painel principal</TooltipContent>
        </Tooltip>

        {/* Groups */}
        {groups.map((group) => {
          const isOpen = openGroup === group.label;
          const groupActive = group.subItems.some((s) => isActive(s.url));

          return (
            <div key={group.label}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl text-xs lg:text-[13px] font-medium transition-all duration-150 ${
                      isOpen || groupActive
                        ? "bg-primary/20 border-l-[3px] border-primary text-foreground"
                        : "bg-slate-700/50 border-l-[3px] border-transparent text-muted-foreground hover:bg-slate-600/50 hover:text-foreground"
                    }`}
                  >
                    <group.icon className={`h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 ${group.color}`} strokeWidth={1.75} />
                    <span className="flex-1 text-left truncate">{group.label}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0 opacity-40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{group.tooltip}</TooltipContent>
              </Tooltip>

              {/* Sub-items */}
              {isOpen && (
                <div className="mt-1 lg:mt-1.5 ml-2 lg:ml-3 space-y-[2px]">
                  {group.subItems.map((sub) => {
                    const subActive = isActive(sub.url);
                    return (
                      <Tooltip key={sub.url}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => go(sub.url)}
                            className={`w-full flex items-center gap-2 lg:gap-2.5 px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-xs lg:text-[13px] font-medium transition-all duration-100 bg-slate-800/50 ${
                              subActive
                                ? "text-primary font-semibold"
                                : "text-muted-foreground hover:text-primary"
                            }`}
                          >
                            <sub.icon className={`h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 ${subActive ? "text-primary" : ""}`} strokeWidth={1.75} />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">{sub.tooltip}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* IA */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { setOpenGroup(null); go("/ia-hub"); }}
              className={`w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl text-xs lg:text-[13px] font-medium transition-all duration-150 ${
                isActive("/ia-hub") || isActive("/ia-")
                  ? "bg-primary/20 border-l-[3px] border-primary text-foreground"
                  : "bg-slate-700/50 border-l-[3px] border-transparent text-muted-foreground hover:bg-slate-600/50 hover:text-foreground"
              }`}
            >
              <Brain className="h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 text-[#F472B6]" strokeWidth={1.75} />
              <span className="truncate">Central de IA</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Ferramentas inteligentes para otimizar seu negócio</TooltipContent>
        </Tooltip>

        {/* Admin */}
        {isAdmin && (
          <>
            <div className="mx-2 h-px bg-border/20 my-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setOpenGroup(null); go("/admin"); }}
                  className={`w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl text-xs lg:text-[13px] font-medium transition-all duration-150 ${
                    isActive("/admin")
                      ? "bg-primary/20 border-l-[3px] border-primary text-foreground"
                      : "bg-slate-700/50 border-l-[3px] border-transparent text-muted-foreground hover:bg-slate-600/50 hover:text-foreground"
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 text-amber-400" strokeWidth={1.75} />
                  <span className="truncate">Admin</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Painel administrativo do sistema</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setOpenGroup(null); go("/master-admin"); }}
                  className={`relative w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl text-xs lg:text-[13px] font-medium transition-all duration-150 ${
                    isActive("/master-admin")
                      ? "bg-primary/20 border-l-[3px] border-primary text-foreground"
                      : "bg-slate-700/50 border-l-[3px] border-transparent text-muted-foreground hover:bg-slate-600/50 hover:text-foreground"
                  }`}
                >
                  <Crown className="h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 text-amber-400" strokeWidth={1.75} />
                  <span className="truncate">Master</span>
                  {pendingCount > 0 && (
                    <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground border-0 rounded-full">
                      {pendingCount}
                    </Badge>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Governança da plataforma</TooltipContent>
            </Tooltip>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/30 p-2 lg:p-3 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl text-xs lg:text-[13px] font-medium bg-slate-700/30 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0" strokeWidth={1.75} />
              <span className="truncate">Sair</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Encerrar sessão e sair do sistema</TooltipContent>
        </Tooltip>
        <div className="mt-1 text-center">
          <VersionBadge />
        </div>
      </div>
    </>
  );
}
