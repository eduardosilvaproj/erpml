import { useState } from "react";
import {
  LayoutDashboard, Package, FileText, ScanBarcode,
  Warehouse, ArrowRightLeft, ShoppingBag, Monitor,
  Users, UsersRound, BarChart3, LogOut, ShieldCheck, DollarSign, Sparkles,
  Building2, Crown, Lock, Megaphone, Boxes, GraduationCap, ClipboardList,
  ChevronRight, Store, Brain, TrendingUp
} from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, usePendingUsers } from "@/hooks/useAdminData";
import { usePlanFeatures, getRequiredPlan } from "@/hooks/usePlanFeatures";
import { useUnansweredMLQuestionsCount } from "@/hooks/useMLNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  premium?: boolean;
}

interface MenuGroup {
  label: string;
  icon: any;
  color: string; // tailwind color class for the group accent
  items: MenuItem[];
}

const topItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Minha Empresa", url: "/empresa", icon: Building2 },
];

const menuGroups: MenuGroup[] = [
  {
    label: "Cadastros",
    icon: Package,
    color: "text-blue-400",
    items: [
      { title: "Produtos", url: "/produtos", icon: Package },
      { title: "Kits", url: "/kits", icon: Boxes },
      { title: "Equipe", url: "/equipe", icon: UsersRound },
      { title: "CRM", url: "/crm", icon: Users },
    ],
  },
  {
    label: "Estoque",
    icon: Warehouse,
    color: "text-emerald-400",
    items: [
      { title: "Estoque", url: "/estoque", icon: Warehouse },
      { title: "Entrada XML", url: "/entrada-xml", icon: FileText },
      { title: "Conferência", url: "/conferencia", icon: ScanBarcode },
      { title: "Balanço", url: "/balanco-estoque", icon: ClipboardList },
      { title: "Envio FULL", url: "/movimentacao-full", icon: ArrowRightLeft, premium: true },
    ],
  },
  {
    label: "Vendas",
    icon: Store,
    color: "text-amber-400",
    items: [
      { title: "PDV", url: "/pdv", icon: Monitor },
      { title: "Campanhas", url: "/campanhas", icon: Megaphone },
      { title: "Integração ML", url: "/integracao-ml", icon: ShoppingBag, premium: true },
    ],
  },
  {
    label: "Gestão",
    icon: TrendingUp,
    color: "text-violet-400",
    items: [
      { title: "Painel HUB", url: "/painel-hub", icon: BarChart3, premium: true },
      { title: "Financeiro", url: "/financeiro", icon: DollarSign, premium: true },
    ],
  },
  {
    label: "Inteligência",
    icon: Brain,
    color: "text-rose-400",
    items: [
      { title: "Central de IA", url: "/ia-hub", icon: Sparkles },
      { title: "Mentor de Vendas", url: "/mentor-vendas", icon: GraduationCap, premium: true },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: pendingUsers } = usePendingUsers(!!isAdmin);
  const pendingCount = isAdmin ? (pendingUsers?.length || 0) : 0;
  const { isRouteAllowed, planName } = usePlanFeatures();
  const unansweredQuestions = useUnansweredMLQuestionsCount();

  const isPathActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const findActiveGroup = () => {
    for (const g of menuGroups) {
      if (g.items.some((item) => isPathActive(item.url))) return g.label;
    }
    return null;
  };

  const STORAGE_KEY = "erp-sidebar-open-groups";

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {}
    const active = findActiveGroup();
    return active ? new Set([active]) : new Set<string>();
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const renderNavItem = (item: MenuItem) => {
    const allowed = isRouteAllowed(item.url);
    const badgeCount = item.url === "/crm" ? unansweredQuestions : 0;

    if (!allowed) {
      const requiredPlan = getRequiredPlan(item.url) || "Superior";
      return (
        <SidebarMenuItem key={item.title}>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-3 px-3 py-1.5 rounded-md text-muted-foreground/25 cursor-not-allowed select-none">
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate text-[13px]">{item.title}</span>
                      <Lock className="h-3 w-3 shrink-0 opacity-40" />
                    </>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs max-w-[200px] space-y-1 p-3">
                <p className="font-medium">🔒 Plano {requiredPlan}</p>
                <p className="text-muted-foreground">Faça upgrade para desbloquear.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SidebarMenuItem>
      );
    }

    const active = isPathActive(item.url);

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className={`flex items-center rounded-md transition-all duration-150 py-1.5 px-3 hover:bg-sidebar-accent/80 ${
              active ? "bg-primary/10 text-primary font-medium" : "text-sidebar-foreground"
            }`}
            activeClassName=""
          >
            <item.icon className="mr-3 h-4 w-4 shrink-0" strokeWidth={1.75} />
            {!collapsed && <span className="text-[13px] flex-1 truncate">{item.title}</span>}
            {!collapsed && item.premium && (
              <Badge variant="outline" className="ml-auto h-4 px-1.5 text-[9px] font-medium border-primary/30 text-primary/70 bg-primary/5">
                Pro
              </Badge>
            )}
            {badgeCount > 0 && (
              <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground border-0 rounded-full animate-pulse">
                {badgeCount}
              </Badge>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (group: MenuGroup) => {
    const isOpen = openGroups.has(group.label);
    const hasActiveRoute = group.items.some((item) => isPathActive(item.url));

    if (collapsed) {
      return (
        <div key={group.label} className="space-y-0.5">
          {group.items.map(renderNavItem)}
        </div>
      );
    }

    return (
      <Collapsible key={group.label} open={isOpen} onOpenChange={() => toggleGroup(group.label)}>
        <CollapsibleTrigger
          className={`flex items-center w-full gap-2.5 px-3 py-2 rounded-md text-[11px] font-semibold uppercase tracking-widest transition-all duration-150 group
            ${hasActiveRoute && !isOpen
              ? "text-sidebar-foreground/80"
              : isOpen
                ? "text-sidebar-foreground/90"
                : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
            }
            hover:bg-sidebar-accent/40
          `}
        >
          <div className={`flex items-center justify-center h-5 w-5 rounded ${group.color}`}>
            <group.icon className="h-3.5 w-3.5" strokeWidth={2} />
          </div>
          <span className="flex-1 text-left">{group.label}</span>
          {hasActiveRoute && !isOpen && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          )}
          <ChevronRight
            className={`h-3 w-3 text-sidebar-foreground/30 transition-transform duration-200 group-hover:text-sidebar-foreground/50 ${
              isOpen ? "rotate-90" : "rotate-0"
            }`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-[18px] border-l border-sidebar-border/60 pl-2.5 py-0.5 space-y-0.5">
            <SidebarMenu>
              {group.items.map(renderNavItem)}
            </SidebarMenu>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="py-3 overflow-y-auto scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <div className="flex items-center gap-2.5 px-2 mb-1">
                <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shadow-[var(--shadow-glow)]">
                  <span className="text-sm font-bold text-primary">E</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-tight text-foreground leading-none">ERP System</span>
                  <span className="text-[10px] text-muted-foreground/50 mt-0.5">Gestão Inteligente</span>
                </div>
              </div>
            )}
          </SidebarGroupLabel>

          <SidebarGroupContent className="mt-3">
            {/* Top-level items */}
            <SidebarMenu className="space-y-0.5 px-2">
              {topItems.map(renderNavItem)}
            </SidebarMenu>

            {/* Separator */}
            {!collapsed && (
              <div className="mx-4 my-2.5">
                <div className="h-px bg-sidebar-border/50" />
              </div>
            )}

            {/* Grouped sections */}
            <div className="space-y-0.5 px-2">
              {menuGroups.map(renderGroup)}
            </div>

            {/* Admin section */}
            {isAdmin && (
              <div className="px-2 mt-2">
                {!collapsed && (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <div className="h-px flex-1 bg-destructive/20" />
                    <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive/70 bg-destructive/5 gap-1 font-semibold">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Admin
                    </Badge>
                    <div className="h-px flex-1 bg-destructive/20" />
                  </div>
                )}
                <SidebarMenu className="space-y-0.5">
                  {renderNavItem({ title: "Admin", url: "/admin", icon: ShieldCheck })}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/master-admin"
                        className="hover:bg-sidebar-accent/80 rounded-md transition-all duration-150 py-1.5 px-3"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <Crown className="mr-3 h-4 w-4" strokeWidth={1.75} />
                        {!collapsed && (
                          <span className="text-[13px] flex-1">Painel Master</span>
                        )}
                        {pendingCount > 0 && (
                          <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground border-0 rounded-full animate-pulse">
                            {pendingCount}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-2.5 p-3 border-t border-sidebar-border/40">
          <div className="flex items-center gap-3">
            <AvatarUpload size="sm" editable={!collapsed} />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                {user?.email && (
                  <span className="text-[11px] text-muted-foreground/70 truncate block leading-tight">{user.email}</span>
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
            className="justify-start text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-md h-8"
          >
            <LogOut className="h-3.5 w-3.5 mr-2.5" strokeWidth={1.75} />
            {!collapsed && <span className="text-[12px]">Sair</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
