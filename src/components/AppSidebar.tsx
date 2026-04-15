import {
  LayoutDashboard, Package, FileText, ScanBarcode,
  Warehouse, ArrowRightLeft, ShoppingBag, Monitor,
  Users, UsersRound, BarChart3, LogOut, ShieldCheck, DollarSign, Sparkles,
  Building2, Crown, Lock, Megaphone, Boxes, GraduationCap, ClipboardList,
  Store, Brain, TrendingUp, CameraIcon, ChevronDown
} from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, usePendingUsers } from "@/hooks/useAdminData";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useUnansweredMLQuestionsCount } from "@/hooks/useMLNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useState } from "react";

export interface MenuItem {
  title: string;
  url: string;
  icon: any;
  desc?: string;
  premium?: boolean;
}

export interface MenuGroup {
  label: string;
  icon: any;
  color: string;
  items: MenuItem[];
}

const topItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Minha Empresa", url: "/empresa", icon: Building2 },
];

export const menuGroups: MenuGroup[] = [
  {
    label: "Cadastros",
    icon: Package,
    color: "text-blue-400",
    items: [
      { title: "Produtos", url: "/produtos", icon: Package, desc: "Cadastro e gestão de produtos" },
      { title: "Kits", url: "/kits", icon: Boxes, desc: "Monte kits compostos" },
      { title: "Equipe", url: "/equipe", icon: UsersRound, desc: "Membros e permissões" },
      { title: "CRM", url: "/crm", icon: Users, desc: "Clientes e perguntas ML" },
    ],
  },
  {
    label: "Estoque",
    icon: Warehouse,
    color: "text-emerald-400",
    items: [
      { title: "Estoque", url: "/estoque", icon: Warehouse, desc: "Saldo físico e FULL" },
      { title: "Entrada Nota", url: "/entrada-nota", icon: CameraIcon, desc: "Importar notas fiscais" },
      { title: "Conferência", url: "/conferencia", icon: ScanBarcode, desc: "Bip de recebimento" },
      { title: "Balanço", url: "/balanco-estoque", icon: ClipboardList, desc: "Inventário físico" },
      { title: "Envio FULL", url: "/movimentacao-full", icon: ArrowRightLeft, desc: "Transferir para FULL", premium: true },
    ],
  },
  {
    label: "Vendas",
    icon: Store,
    color: "text-amber-400",
    items: [
      { title: "PDV", url: "/pdv", icon: Monitor, desc: "Ponto de venda" },
      { title: "Campanhas", url: "/campanhas", icon: Megaphone, desc: "Anúncios em massa" },
      { title: "Integração ML", url: "/integracao-ml", icon: ShoppingBag, desc: "Mercado Livre", premium: true },
      { title: "Minha Loja", url: "/minha-loja/configurar", icon: Store, desc: "Vitrine virtual" },
    ],
  },
  {
    label: "Gestão",
    icon: TrendingUp,
    color: "text-violet-400",
    items: [
      { title: "Painel HUB", url: "/painel-hub", icon: BarChart3, desc: "Relatórios e métricas", premium: true },
      { title: "Financeiro", url: "/financeiro", icon: DollarSign, desc: "Cobranças e pagamentos", premium: true },
    ],
  },
  {
    label: "Inteligência",
    icon: Brain,
    color: "text-rose-400",
    items: [
      { title: "Central de IA", url: "/ia-hub", icon: Sparkles, desc: "Ferramentas de IA" },
      { title: "Mentor de Vendas", url: "/mentor-vendas", icon: GraduationCap, desc: "Crescimento guiado", premium: true },
    ],
  },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: pendingUsers } = usePendingUsers(!!isAdmin);
  const pendingCount = isAdmin ? (pendingUsers?.length || 0) : 0;
  const { planName } = usePlanFeatures();
  const unansweredQuestions = useUnansweredMLQuestionsCount();
  const isMobile = useIsMobile();

  const isPathActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  // Find which group contains the active route
  const activeGroupLabel = menuGroups.find((g) =>
    g.items.some((item) => isPathActive(item.url))
  )?.label ?? null;

  const [openGroup, setOpenGroup] = useState<string | null>(activeGroupLabel);

  const toggleGroup = (label: string) => {
    setOpenGroup((prev) => (prev === label ? null : label));
  };

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="py-3 overflow-y-auto scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupContent>
            {/* Logo */}
            {!collapsed && (
              <div className="flex items-center gap-2.5 px-4 mb-4">
                <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shadow-[var(--shadow-glow)]">
                  <span className="text-base font-bold text-primary">E</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-tight text-foreground leading-none">ERP System</span>
                  <span className="text-[10px] text-muted-foreground/50 mt-0.5">Gestão Inteligente</span>
                </div>
              </div>
            )}

            {/* Top-level nav items */}
            <div className="space-y-1 px-2 mb-2">
              {topItems.map((item) => {
                const active = isPathActive(item.url);
                return (
                  <NavLink
                    key={item.title}
                    to={item.url}
                    end={item.url === "/"}
                    onClick={handleNavClick}
                    className={`flex items-center gap-3 rounded-lg transition-all duration-150 min-h-[44px] py-2 px-3 active:scale-[0.98] hover:bg-sidebar-accent/80 ${
                      active ? "bg-primary/10 text-primary font-medium" : "text-sidebar-foreground"
                    }`}
                    activeClassName=""
                  >
                    <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                    {!collapsed && <span className="text-sm">{item.title}</span>}
                  </NavLink>
                );
              })}
            </div>

            {/* Separator */}
            {!collapsed && (
              <div className="mx-4 my-3">
                <div className="h-px bg-sidebar-border/50" />
              </div>
            )}

            {/* Accordion groups */}
            <div className="space-y-1 px-2">
              {menuGroups.map((group) => {
                const isOpen = openGroup === group.label;
                const hasActiveRoute = group.items.some((item) => isPathActive(item.url));

                return (
                  <div key={group.label}>
                    {/* Group header button */}
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className={`flex items-center gap-3 w-full rounded-lg transition-all duration-200 min-h-[44px] py-2 px-3 active:scale-[0.97] group ${
                        isOpen
                          ? "bg-primary/10 border-l-[3px] border-l-primary"
                          : hasActiveRoute
                          ? "bg-primary/5 border-l-[3px] border-l-primary/40"
                          : "hover:bg-sidebar-accent/50 border-l-[3px] border-l-transparent"
                      }`}
                    >
                      <div className={`flex items-center justify-center h-8 w-8 rounded-lg transition-colors ${
                        isOpen ? "bg-primary/15" : "bg-sidebar-accent/60 group-hover:bg-sidebar-accent"
                      }`}>
                        <group.icon className={`h-4.5 w-4.5 ${isOpen ? "text-primary" : group.color}`} strokeWidth={1.75} />
                      </div>
                      {!collapsed && (
                        <>
                          <span className={`text-sm font-semibold flex-1 text-left ${
                            isOpen ? "text-primary" : "text-sidebar-foreground"
                          }`}>
                            {group.label}
                          </span>
                          {group.label === "Cadastros" && unansweredQuestions > 0 && (
                            <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground border-0 rounded-full animate-pulse shrink-0">
                              {unansweredQuestions}
                            </Badge>
                          )}
                          <ChevronDown className={`h-4 w-4 text-muted-foreground/60 transition-transform duration-200 shrink-0 ${
                            isOpen ? "rotate-180" : ""
                          }`} />
                        </>
                      )}
                    </button>

                    {/* Subcategory items - accordion */}
                    {!collapsed && isOpen && (
                      <div className="ml-5 mt-1 mb-1 space-y-0.5 border-l-2 border-sidebar-border/30 pl-3 animate-accordion-down overflow-hidden">
                        {group.items.map((item) => {
                          const active = isPathActive(item.url);
                          return (
                            <NavLink
                              key={item.title}
                              to={item.url}
                              onClick={handleNavClick}
                              className={`flex items-center gap-2.5 rounded-lg transition-all duration-150 min-h-[38px] py-1.5 px-2.5 active:scale-[0.98] ${
                                active
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                              }`}
                              activeClassName=""
                            >
                              <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground/60"}`} strokeWidth={1.75} />
                              <div className="flex-1 min-w-0">
                                <span className="text-[13px] block truncate">{item.title}</span>
                              </div>
                              {item.premium && (
                                <Badge variant="outline" className="text-[8px] border-primary/30 text-primary/60 bg-primary/5 px-1 py-0 h-4 shrink-0">
                                  Pro
                                </Badge>
                              )}
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Admin section */}
            {isAdmin && (
              <div className="px-2 mt-3">
                {!collapsed && (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="h-px flex-1 bg-destructive/20" />
                    <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive/70 bg-destructive/5 gap-1 font-semibold">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Admin
                    </Badge>
                    <div className="h-px flex-1 bg-destructive/20" />
                  </div>
                )}
                <div className="space-y-1">
                  <NavLink
                    to="/admin"
                    onClick={handleNavClick}
                    className="flex items-center gap-3 rounded-lg transition-all duration-150 min-h-[44px] py-2 px-3 active:scale-[0.98] hover:bg-sidebar-accent/80 text-sidebar-foreground"
                    activeClassName="bg-primary/10 text-primary font-medium"
                  >
                    <ShieldCheck className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                    {!collapsed && <span className="text-sm">Admin</span>}
                  </NavLink>
                  <NavLink
                    to="/master-admin"
                    onClick={handleNavClick}
                    className="flex items-center gap-3 rounded-lg transition-all duration-150 min-h-[44px] py-2 px-3 active:scale-[0.98] hover:bg-sidebar-accent/80 text-sidebar-foreground"
                    activeClassName="bg-primary/10 text-primary font-medium"
                  >
                    <Crown className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                    {!collapsed && <span className="text-sm flex-1">Painel Master</span>}
                    {pendingCount > 0 && (
                      <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground border-0 rounded-full animate-pulse">
                        {pendingCount}
                      </Badge>
                    )}
                  </NavLink>
                </div>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-3 p-3 border-t border-sidebar-border/40">
          <div className="flex items-center gap-3 min-h-[44px]">
            <AvatarUpload size="sm" editable={!collapsed} />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                {user?.email && (
                  <span className="text-xs text-muted-foreground/70 truncate block leading-tight">{user.email}</span>
                )}
                {planName && (
                  <Badge variant="outline" className="w-fit text-[9px] mt-1 border-primary/25 text-primary/70 bg-primary/5">
                    {planName}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="justify-start text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg min-h-[44px] active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4 mr-2.5" strokeWidth={1.75} />
            {!collapsed && <span className="text-sm">Sair</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
