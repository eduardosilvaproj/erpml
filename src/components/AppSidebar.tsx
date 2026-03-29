import {
  LayoutDashboard, Package, FileText, ScanBarcode,
  Warehouse, ArrowRightLeft, ShoppingBag, Monitor,
  Users, BarChart3, LogOut, ShieldCheck
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useAdminData";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Entrada XML", url: "/entrada-xml", icon: FileText },
  { title: "Conferência", url: "/conferencia", icon: ScanBarcode },
  { title: "Estoque", url: "/estoque", icon: Warehouse },
  { title: "Envio FULL", url: "/movimentacao-full", icon: ArrowRightLeft },
  { title: "Integração ML", url: "/integracao-ml", icon: ShoppingBag },
  { title: "PDV", url: "/pdv", icon: Monitor },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Painel HUB", url: "/painel-hub", icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { data: isAdmin } = useIsAdmin();

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
              {menuItems.map((item) => (
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2 p-2">
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
