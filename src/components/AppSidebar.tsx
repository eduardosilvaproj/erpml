import {
  LayoutDashboard, Package, Warehouse, Store, TrendingUp, Brain,
  LogOut, ShieldCheck, Crown, Boxes, Users, UsersRound, ScanBarcode,
  ClipboardList, Monitor, Megaphone, ShoppingBag, Building2, BarChart3,
  Settings
} from "lucide-react";
import { createContext, useContext, useState } from "react";
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

// Context for the sub-drawer
interface SubDrawerContextType {
  openGroup: string | null;
  setOpenGroup: (g: string | null) => void;
}
export const SubDrawerContext = createContext<SubDrawerContextType>({
  openGroup: null,
  setOpenGroup: () => {},
});
export const useSubDrawer = () => useContext(SubDrawerContext);

interface SubItem {
  label: string;
  url: string;
  icon: any;
}

interface NavItem {
  label: string;
  icon: any;
  url: string;
  subItems?: SubItem[];
}

const navItems: NavItem[] = [
  { label: "Início", icon: LayoutDashboard, url: "/" },
  {
    label: "Cadastros", icon: Package, url: "/produtos",
    subItems: [
      { label: "Produtos", url: "/produtos", icon: Package },
      { label: "Kits", url: "/kits", icon: Boxes },
      { label: "Equipe", url: "/equipe", icon: UsersRound },
      { label: "CRM / Clientes", url: "/crm", icon: Users },
    ],
  },
  {
    label: "Estoque", icon: Warehouse, url: "/estoque",
    subItems: [
      { label: "Ver Estoque", url: "/estoque", icon: Warehouse },
      { label: "Entrada de Nota", url: "/entrada-nota", icon: ClipboardList },
      { label: "Conferência", url: "/conferencia", icon: ScanBarcode },
      { label: "Balanço", url: "/balanco-estoque", icon: BarChart3 },
    ],
  },
  {
    label: "Vendas", icon: Store, url: "/pdv",
    subItems: [
      { label: "PDV", url: "/pdv", icon: Monitor },
      { label: "Campanhas", url: "/campanhas", icon: Megaphone },
      { label: "Integrações", url: "/integracao-ml", icon: ShoppingBag },
    ],
  },
  {
    label: "Gestão", icon: TrendingUp, url: "/empresa",
    subItems: [
      { label: "Minha Empresa", url: "/empresa", icon: Building2 },
      { label: "Painel HUB", url: "/painel-hub", icon: BarChart3 },
      { label: "Financeiro", url: "/financeiro", icon: Settings },
    ],
  },
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
  const { openGroup, setOpenGroup } = useSubDrawer();

  const isPathActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const isGroupActive = (item: NavItem) => {
    if (!item.subItems) return isPathActive(item.url);
    return item.subItems.some((s) => isPathActive(s.url));
  };

  const handleNav = (url: string) => {
    navigate(url);
    setOpenGroup(null);
    if (isMobile) setOpenMobile(false);
  };

  const handleGroupClick = (item: NavItem) => {
    if (item.subItems) {
      // Toggle drawer
      setOpenGroup(openGroup === item.label ? null : item.label);
    } else {
      setOpenGroup(null);
      handleNav(item.url);
    }
  };

  // Find current open group data
  const activeGroupData = navItems.find((n) => n.label === openGroup);

  return (
    <>
      <Sidebar collapsible="none" className="w-[70px] min-w-[70px] border-r border-border/40 z-40">
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
                const active = isGroupActive(item);
                const isOpen = openGroup === item.label;

                return (
                  <button
                    key={item.label}
                    onClick={() => handleGroupClick(item)}
                    className={`relative flex flex-col items-center justify-center w-12 h-12 mx-auto rounded-[10px] transition-all duration-150 active:scale-95 group ${
                      active || isOpen
                        ? "bg-primary/8"
                        : "hover:bg-sidebar-accent/60"
                    }`}
                  >
                    {active && !isOpen && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary" />
                    )}
                    {isOpen && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-accent-foreground" />
                    )}
                    <item.icon
                      className={`h-7 w-7 ${active || isOpen ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
                      strokeWidth={1.75}
                    />
                    <span className={`text-[11px] mt-1 leading-tight ${
                      active || isOpen ? "text-primary font-semibold" : "text-muted-foreground/70"
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
                    onClick={() => { setOpenGroup(null); handleNav("/admin"); }}
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
                    onClick={() => { setOpenGroup(null); handleNav("/master-admin"); }}
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

      {/* Sub-drawer */}
      {activeGroupData && activeGroupData.subItems && (
        <div
          className="w-[200px] min-w-[200px] border-r border-border/40 bg-sidebar flex flex-col z-30 animate-in slide-in-from-left-4 duration-200"
        >
          <div className="p-4 border-b border-border/30">
            <h3 className="text-sm font-bold text-foreground">{activeGroupData.label}</h3>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {activeGroupData.subItems.map((sub) => {
              const subActive = isPathActive(sub.url);
              return (
                <button
                  key={sub.url}
                  onClick={() => handleNav(sub.url)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-100 active:scale-[0.98] ${
                    subActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <sub.icon className={`h-4 w-4 shrink-0 ${subActive ? "text-primary" : ""}`} strokeWidth={1.75} />
                  <span>{sub.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
