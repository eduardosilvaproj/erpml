import {
  LayoutDashboard, Package, FileText, ScanBarcode,
  Warehouse, ArrowRightLeft, ShoppingBag, Monitor,
  Users, UsersRound, BarChart3, LogOut, ShieldCheck, DollarSign, Sparkles,
  Building2, Crown, Lock, Megaphone, MessageSquare, Search
} from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, usePendingUsers } from "@/hooks/useAdminData";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
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

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Minha Empresa", url: "/empresa", icon: Building2 },
  { title: "Equipe", url: "/equipe", icon: UsersRound },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Entrada XML", url: "/entrada-xml", icon: FileText },
  { title: "Conferência", url: "/conferencia", icon: ScanBarcode },
  { title: "Estoque", url: "/estoque", icon: Warehouse },
  { title: "Envio FULL", url: "/movimentacao-full", icon: ArrowRightLeft },
  { title: "Integração ML", url: "/integracao-ml", icon: ShoppingBag },
  { title: "Campanhas", url: "/campanhas", icon: Megaphone },
  { title: "PDV", url: "/pdv", icon: Monitor },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Painel HUB", url: "/painel-hub", icon: BarChart3 },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "IA Tributária", url: "/ia-consulta", icon: Sparkles },
  { title: "Pesquisa Intel.", url: "/pesquisa", icon: Search },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: pendingUsers } = usePendingUsers();
  const pendingCount = isAdmin ? (pendingUsers?.length || 0) : 0;
  const { isRouteAllowed, planName } = usePlanFeatures();
  const unansweredQuestions = useUnansweredMLQuestionsCount();

  const renderNavItem = (item: typeof menuItems[0], extraClass = "") => {
    const badgeCount = item.url === "/crm" ? unansweredQuestions : 0;

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className="hover:bg-sidebar-accent rounded-xl transition-all duration-200 py-2.5 px-3"
            activeClassName="bg-primary/12 text-primary font-medium border-l-[3px] border-primary rounded-l-none"
          >
            <item.icon className="mr-3 h-[18px] w-[18px]" strokeWidth={1.75} />
            {!collapsed && <span className="text-[13px] flex-1">{item.title}</span>}
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

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="py-3">
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <div className="flex items-center gap-2.5 px-1">
                <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center shadow-glow">
                  <span className="text-sm font-bold text-primary">E</span>
                </div>
                <span className="text-sm font-bold tracking-tight text-foreground">ERP System</span>
              </div>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-5">
            <SidebarMenu className="space-y-0.5 px-2">
              {menuItems.map((item) => {
                const allowed = isRouteAllowed(item.url);
                
                if (!allowed) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground/30 cursor-not-allowed select-none">
                              <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                              {!collapsed && (
                                <>
                                  <span className="flex-1 truncate text-[13px]">{item.title}</span>
                                  <Lock className="h-3 w-3 shrink-0 opacity-40" />
                                </>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            Disponível nos planos superiores
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </SidebarMenuItem>
                  );
                }

                return renderNavItem(item);
              })}
              {isAdmin && (
                <>
                  {!collapsed && (
                    <li className="px-3 pt-4 pb-1">
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border" />
                        <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive/80 bg-destructive/5 gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </Badge>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    </li>
                  )}
                  {renderNavItem({ title: "Admin", url: "/admin", icon: ShieldCheck })}
                  <SidebarMenuItem key="Painel Master">
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/master-admin"
                        className="hover:bg-sidebar-accent rounded-xl transition-all duration-200 py-2.5 px-3"
                        activeClassName="bg-primary/12 text-primary font-medium border-l-[3px] border-primary rounded-l-none"
                      >
                        <Crown className="mr-3 h-[18px] w-[18px]" strokeWidth={1.75} />
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
                </>
              )}
            </SidebarMenu>
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
          <Button variant="ghost" size="sm" onClick={signOut} className="justify-start text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-xl">
            <LogOut className="h-4 w-4 mr-2.5" strokeWidth={1.75} />
            {!collapsed && <span className="text-[13px]">Sair</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
