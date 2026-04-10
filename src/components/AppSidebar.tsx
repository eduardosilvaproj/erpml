import { useState } from "react";
import {
  LayoutDashboard, Package, FileText, ScanBarcode,
  Warehouse, ArrowRightLeft, ShoppingBag, Monitor,
  Users, UsersRound, BarChart3, LogOut, ShieldCheck, DollarSign, Sparkles,
  Building2, Crown, Lock, Megaphone, Boxes, GraduationCap, ClipboardList,
  ChevronDown, Store, Brain, Settings, TrendingUp
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
    items: [
      { title: "PDV", url: "/pdv", icon: Monitor },
      { title: "Campanhas", url: "/campanhas", icon: Megaphone },
      { title: "Integração ML", url: "/integracao-ml", icon: ShoppingBag, premium: true },
    ],
  },
  {
    label: "Gestão",
    icon: TrendingUp,
    items: [
      { title: "Painel HUB", url: "/painel-hub", icon: BarChart3, premium: true },
      { title: "Financeiro", url: "/financeiro", icon: DollarSign, premium: true },
    ],
  },
  {
    label: "Inteligência",
    icon: Brain,
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

  // Track which groups are open - auto-open the group containing the current route
  const findActiveGroup = () => {
    for (let i = 0; i < menuGroups.length; i++) {
      if (menuGroups[i].items.some((item) => {
        if (item.url === "/") return location.pathname === "/";
        return location.pathname.startsWith(item.url);
      })) {
        return menuGroups[i].label;
      }
    }
    return null;
  };

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const active = findActiveGroup();
    return active ? new Set([active]) : new Set<string>();
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
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
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground/30 cursor-not-allowed select-none">
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

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className="hover:bg-sidebar-accent rounded-lg transition-all duration-150 py-2 px-3"
            activeClassName="bg-primary/10 text-primary font-medium"
          >
            <item.icon className="mr-3 h-4 w-4" strokeWidth={1.75} />
            {!collapsed && <span className="text-[13px] flex-1">{item.title}</span>}
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
    const hasActiveRoute = group.items.some((item) => {
      if (item.url === "/") return location.pathname === "/";
      return location.pathname.startsWith(item.url);
    });

    if (collapsed) {
      // In collapsed mode, show only group icon as a tooltip
      return (
        <div key={group.label} className="space-y-0.5">
          {group.items.map(renderNavItem)}
        </div>
      );
    }

    return (
      <Collapsible key={group.label} open={isOpen} onOpenChange={() => toggleGroup(group.label)}>
        <CollapsibleTrigger className="flex items-center w-full gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground hover:bg-sidebar-accent/50 transition-colors">
          <group.icon className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="flex-1 text-left">{group.label}</span>
          {hasActiveRoute && !isOpen && (
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-2 space-y-0.5 mt-0.5">
          <SidebarMenu>
            {group.items.map(renderNavItem)}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="py-3">
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <div className="flex items-center gap-2.5 px-1">
                <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">E</span>
                </div>
                <span className="text-sm font-bold tracking-tight text-foreground">ERP System</span>
              </div>
            )}
          </SidebarGroupLabel>

          <SidebarGroupContent className="mt-4">
            {/* Top-level items (always visible) */}
            <SidebarMenu className="space-y-0.5 px-2">
              {topItems.map(renderNavItem)}
            </SidebarMenu>

            {/* Grouped sections */}
            <div className="mt-3 space-y-1 px-2">
              {menuGroups.map(renderGroup)}
            </div>

            {/* Admin section */}
            {isAdmin && (
              <div className="mt-3 px-2">
                {!collapsed && (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <div className="h-px flex-1 bg-border" />
                    <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive/80 bg-destructive/5 gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Admin
                    </Badge>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <SidebarMenu className="space-y-0.5">
                  {renderNavItem({ title: "Admin", url: "/admin", icon: ShieldCheck })}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/master-admin"
                        className="hover:bg-sidebar-accent rounded-lg transition-all duration-150 py-2 px-3"
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
        <div className="flex flex-col gap-3 p-3 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3">
            <AvatarUpload size="sm" editable={!collapsed} />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                {user?.email && (
                  <span className="text-xs text-muted-foreground truncate block leading-tight">{user.email}</span>
                )}
                {planName && (
                  <Badge variant="outline" className="w-fit text-[10px] mt-1.5 border-primary/30 text-primary/80 bg-primary/5">
                    {planName}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="justify-start text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg">
            <LogOut className="h-4 w-4 mr-2.5" strokeWidth={1.75} />
            {!collapsed && <span className="text-[13px]">Sair</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
