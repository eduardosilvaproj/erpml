import {
  LayoutDashboard, Package, FileText, ScanBarcode,
  Warehouse, ArrowRightLeft, ShoppingBag, Monitor,
  Users, UsersRound, BarChart3, LogOut, ShieldCheck, DollarSign, Sparkles,
  Building2, Crown, Lock
} from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdminData";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
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
  { title: "PDV", url: "/pdv", icon: Monitor },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Painel HUB", url: "/painel-hub", icon: BarChart3 },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "IA Tributária", url: "/ia-consulta", icon: Sparkles },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { isRouteAllowed, planName } = usePlanFeatures();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <div className="flex items-center gap-2.5 px-1">
                <div className="h-7 w-7 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-sidebar-primary">E</span>
                </div>
                <span className="text-sm font-bold tracking-tight text-sidebar-foreground">ERP System</span>
              </div>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-4">
            <SidebarMenu className="space-y-0.5">
              {menuItems.map((item) => {
                const allowed = isRouteAllowed(item.url);
                
                if (!allowed) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-muted-foreground/40 cursor-not-allowed select-none transition-colors">
                              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                              {!collapsed && (
                                <>
                                  <span className="flex-1 truncate text-sm">{item.title}</span>
                                  <Lock className="h-3 w-3 shrink-0 opacity-50" />
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

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent/60 rounded-lg transition-all duration-200"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium shadow-premium-xs"
                      >
                        <item.icon className="mr-2.5 h-4 w-4" strokeWidth={1.75} />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {isAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin"
                        className="hover:bg-sidebar-accent/60 rounded-lg transition-all duration-200"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <ShieldCheck className="mr-2.5 h-4 w-4" strokeWidth={1.75} />
                        {!collapsed && <span className="text-sm">Admin</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/master-admin"
                        className="hover:bg-sidebar-accent/60 rounded-lg transition-all duration-200"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <Crown className="mr-2.5 h-4 w-4" strokeWidth={1.75} />
                        {!collapsed && <span className="text-sm">Painel Master</span>}
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
        <div className="flex flex-col gap-2.5 p-3 border-t border-sidebar-border/40">
          <div className="flex items-center gap-2.5">
            <AvatarUpload size="sm" editable={!collapsed} />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                {user?.email && (
                  <span className="text-xs text-sidebar-foreground/70 truncate block leading-tight">{user.email}</span>
                )}
                {planName && (
                  <Badge variant="outline" className="w-fit text-[10px] mt-1 border-sidebar-border/60 text-sidebar-foreground/60">
                    {planName}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60">
            <LogOut className="h-4 w-4 mr-2" strokeWidth={1.75} />
            {!collapsed && <span className="text-sm">Sair</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
