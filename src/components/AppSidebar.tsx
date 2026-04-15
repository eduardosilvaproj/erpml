import { useState } from "react";
import {
  Home, Package, Warehouse, Store, TrendingUp, Brain,
  LogOut, ShieldCheck, Crown, ChevronDown, Boxes, UsersRound,
  Users, ClipboardList, ScanBarcode, Monitor, Megaphone,
  Building2, BarChart3, ShoppingBag, BarChart, DollarSign
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, usePendingUsers } from "@/hooks/useAdminData";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const toggleGroup = (label: string) => {
    setOpenGroup(openGroup === label ? null : label);
  };

  const go = (url: string) => navigate(url);

  return (
    <aside className="w-[230px] min-w-[230px] h-screen sticky top-0 border-r border-border/40 bg-sidebar flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border/30 shrink-0">
        <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center">
          <span className="text-base font-bold text-primary">E</span>
        </div>
        <span className="text-sm font-bold text-foreground tracking-tight">ERP System</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
        {/* Início */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { setOpenGroup(null); go("/"); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                isActive("/")
                  ? "bg-blue-600/30 border-l-[3px] border-blue-400 text-foreground"
                  : "bg-slate-700/50 border-l-[3px] border-transparent text-muted-foreground hover:bg-slate-600/50 hover:text-foreground"
              }`}
            >
              <Home className="h-[18px] w-[18px] shrink-0 text-foreground" strokeWidth={1.75} />
              <span>Início</span>
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
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                      isOpen || groupActive
                        ? "bg-blue-600/30 border-l-[3px] border-blue-400 text-foreground"
                        : "bg-slate-700/50 border-l-[3px] border-transparent text-muted-foreground hover:bg-slate-600/50 hover:text-foreground"
                    }`}
                  >
                    <group.icon className={`h-[18px] w-[18px] shrink-0 ${group.color}`} strokeWidth={1.75} />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 opacity-40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{group.tooltip}</TooltipContent>
              </Tooltip>

              {/* Sub-items */}
              {isOpen && (
                <div className="mt-1.5 ml-3 space-y-[2px]">
                  {group.subItems.map((sub) => {
                    const subActive = isActive(sub.url);
                    return (
                      <Tooltip key={sub.url}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => go(sub.url)}
                            className={`w-full flex items-center gap-2.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 bg-slate-800/50 ${
                              subActive
                                ? "text-blue-400 font-semibold"
                                : "text-muted-foreground hover:text-blue-300"
                            }`}
                          >
                            <sub.icon className={`h-[18px] w-[18px] shrink-0 ${subActive ? "text-blue-400" : ""}`} strokeWidth={1.75} />
                            <span>{sub.label}</span>
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
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                isActive("/ia-hub") || isActive("/ia-")
                  ? "bg-blue-600/30 border-l-[3px] border-blue-400 text-foreground"
                  : "bg-slate-700/50 border-l-[3px] border-transparent text-muted-foreground hover:bg-slate-600/50 hover:text-foreground"
              }`}
            >
              <Brain className="h-[18px] w-[18px] shrink-0 text-[#F472B6]" strokeWidth={1.75} />
              <span>Central de IA</span>
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                    isActive("/admin")
                      ? "bg-blue-600/30 border-l-[3px] border-blue-400 text-foreground"
                      : "bg-slate-700/50 border-l-[3px] border-transparent text-muted-foreground hover:bg-slate-600/50 hover:text-foreground"
                  }`}
                >
                  <ShieldCheck className="h-[18px] w-[18px] shrink-0 text-amber-400" strokeWidth={1.75} />
                  <span>Admin</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Painel administrativo do sistema</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setOpenGroup(null); go("/master-admin"); }}
                  className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                    isActive("/master-admin")
                      ? "bg-blue-600/30 border-l-[3px] border-blue-400 text-foreground"
                      : "bg-slate-700/50 border-l-[3px] border-transparent text-muted-foreground hover:bg-slate-600/50 hover:text-foreground"
                  }`}
                >
                  <Crown className="h-[18px] w-[18px] shrink-0 text-amber-400" strokeWidth={1.75} />
                  <span>Master</span>
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
      <div className="border-t border-border/30 p-3 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium bg-slate-700/30 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              <span>Sair</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Encerrar sessão e sair do sistema</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
