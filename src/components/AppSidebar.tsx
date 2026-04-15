import {
  LayoutDashboard, Package, Warehouse, Store, TrendingUp, Brain,
  LogOut, ShieldCheck, Crown
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, usePendingUsers } from "@/hooks/useAdminData";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

// Re-export types and data for backward compat
export type { MenuItem, MenuGroup } from "@/lib/menu-data";
export { menuGroups } from "@/lib/menu-data";

interface NavItem {
  label: string;
  icon: any;
  url: string;
}

const navItems: NavItem[] = [
  { label: "Início", icon: LayoutDashboard, url: "/" },
  { label: "Cadastros", icon: Package, url: "/produtos" },
  { label: "Estoque", icon: Warehouse, url: "/estoque" },
  { label: "Vendas", icon: Store, url: "/pdv" },
  { label: "Gestão", icon: TrendingUp, url: "/painel-hub" },
  { label: "IA", icon: Brain, url: "/ia-hub" },
];

export function AppSidebar() {
  const { setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: pendingUsers } = usePendingUsers(!!isAdmin);
  const pendingCount = isAdmin ? (pendingUsers?.length || 0) : 0;
  const isMobile = useIsMobile();

  const isPathActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const handleNav = (url: string) => {
    navigate(url);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="none" className="w-[70px] min-w-[70px] border-r border-border/40">
      <SidebarContent className="py-4 overflow-y-auto scrollbar-thin items-center">
        <SidebarGroup>
          <SidebarGroupContent className="space-y-1">
            {/* Logo */}
            <div className="flex items-center justify-center mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">E</span>
              </div>
            </div>

            {/* Nav items */}
            {navItems.map((item) => {
              const active = isPathActive(item.url);
              return (
                <button
                  key={item.label}
                  onClick={() => handleNav(item.url)}
                  className={`relative flex flex-col items-center justify-center w-12 h-12 mx-auto rounded-[10px] transition-all duration-150 active:scale-95 group ${
                    active
                      ? "bg-primary/8"
                      : "hover:bg-sidebar-accent/60"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary" />
                  )}
                  <item.icon
                    className={`h-7 w-7 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
                    strokeWidth={1.75}
                  />
                  <span className={`text-[11px] mt-1 leading-tight ${
                    active ? "text-primary font-semibold" : "text-muted-foreground/70"
                  }`}>
                    {item.label}
                  </span>
                </button>
              );
            })}

            {/* Admin */}
            {isAdmin && (
              <>
                <div className="mx-auto w-8 h-px bg-border/40 my-2" />
                <button
                  onClick={() => handleNav("/admin")}
                  className={`relative flex flex-col items-center justify-center w-full py-2.5 rounded-lg transition-all duration-150 active:scale-95 group ${
                    isPathActive("/admin") ? "bg-primary/10" : "hover:bg-sidebar-accent/60"
                  }`}
                >
                  {isPathActive("/admin") && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary" />
                  )}
                  <ShieldCheck className={`h-6 w-6 ${isPathActive("/admin") ? "text-primary" : "text-muted-foreground"}`} strokeWidth={1.75} />
                  <span className="text-[10px] mt-1 text-muted-foreground/70">Admin</span>
                </button>
                <button
                  onClick={() => handleNav("/master-admin")}
                  className={`relative flex flex-col items-center justify-center w-full py-2.5 rounded-lg transition-all duration-150 active:scale-95 group ${
                    isPathActive("/master-admin") ? "bg-primary/10" : "hover:bg-sidebar-accent/60"
                  }`}
                >
                  {isPathActive("/master-admin") && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary" />
                  )}
                  <Crown className={`h-6 w-6 ${isPathActive("/master-admin") ? "text-primary" : "text-muted-foreground"}`} strokeWidth={1.75} />
                  <span className="text-[10px] mt-1 text-muted-foreground/70">Master</span>
                  {pendingCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[8px] bg-destructive text-destructive-foreground border-0 rounded-full">
                      {pendingCount}
                    </Badge>
                  )}
                </button>
              </>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="items-center pb-4">
        <button
          onClick={signOut}
          className="flex flex-col items-center justify-center py-2.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-95 w-full"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.75} />
          <span className="text-[10px] mt-1">Sair</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
