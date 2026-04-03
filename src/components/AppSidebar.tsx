import {
  LayoutDashboard, Package, FileText, ScanBarcode,
  Warehouse, ArrowRightLeft, ShoppingBag, Monitor,
  Users, BarChart3, LogOut, ShieldCheck, DollarSign, Sparkles,
  Building2, Crown, Lock
} from "lucide-react";
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
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <span className="text-base font-bold tracking-tight">ERP System</span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const allowed = isRouteAllowed(item.url);
                
                if (!allowed) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground/50 cursor-not-allowed select-none">
                              <item.icon className="h-4 w-4 shrink-0" />
                              {!collapsed && (
                                <>
                                  <span className="flex-1 truncate">{item.title}</span>
                                  <Lock className="h-3 w-3 shrink-0" />
                                </>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs">Disponível nos planos superiores</p>
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
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
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
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        {!collapsed && <span>Admin</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/master-admin"
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <Crown className="mr-2 h-4 w-4" />
                        {!collapsed && <span>Painel Master</span>}
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
        <div className="flex flex-col gap-2 p-2">
          {!collapsed && planName && (
            <Badge variant="outline" className="w-fit text-xs">
              {planName}
            </Badge>
          )}
          {!collapsed && user?.email && (
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          )}
          <Button variant="ghost" size="sm" onClick={signOut} className="justify-start">
            <LogOut className="h-4 w-4 mr-2" />
            {!collapsed && "Sair"}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
