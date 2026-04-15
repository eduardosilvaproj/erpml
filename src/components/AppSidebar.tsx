import {
  LayoutDashboard, Package, Warehouse, Store, TrendingUp, Brain,
  LogOut, ShieldCheck, Crown, ChevronDown, Users, ScanBarcode,
  ClipboardList, Monitor, Megaphone, Building2, BarChart3
} from "lucide-react";
import { useState } from "react";
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

interface SubItem {
  label: string;
  url: string;
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
      { label: "Produtos", url: "/produtos" },
      { label: "CRM / Clientes", url: "/crm" },
    ],
  },
  {
    label: "Estoque", icon: Warehouse, url: "/estoque",
    subItems: [
      { label: "Ver Estoque", url: "/estoque" },
      { label: "Entrada de Nota", url: "/entrada-nota" },
      { label: "Conferência", url: "/conferencia" },
    ],
  },
  {
    label: "Vendas", icon: Store, url: "/crm",
    subItems: [
      { label: "PDV", url: "/pdv" },
      { label: "Campanhas", url: "/campanhas" },
    ],
  },
  {
    label: "Gestão", icon: TrendingUp, url: "/empresa",
    subItems: [
      { label: "Minha Empresa", url: "/empresa" },
      { label: "Painel HUB", url: "/painel-hub" },
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
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

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
    if (isMobile) setOpenMobile(false);
  };

  const handleGroupClick = (item: NavItem) => {
    if (item.subItems) {
      if (expandedGroup === item.label) {
        setExpandedGroup(null);
      } else {
        setExpandedGroup(item.label);
        handleNav(item.url);
      }
    } else {
      setExpandedGroup(null);
      handleNav(item.url);
    }
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
              const active = isGroupActive(item);
              const expanded = expandedGroup === item.label;
              const hasSubItems = !!item.subItems;

              return (
                <div key={item.label}>
                  <button
                    onClick={() => handleGroupClick(item)}
                    className={`relative flex flex-col items-center justify-center w-12 h-12 mx-auto rounded-[10px] transition-all duration-150 active:scale-95 group ${
                      active
                        ? "bg-primary/8"
                        : "hover:bg-sidebar-accent/60"
                    }`}
                  >
                    {active && !expanded && (
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
                    {hasSubItems && (
                      <ChevronDown className={`absolute -bottom-0.5 h-3 w-3 text-muted-foreground/50 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                    )}
                  </button>

                  {/* Sub-items accordion */}
                  {hasSubItems && expanded && (
                    <div className="mt-1 mb-1 space-y-0.5">
                      {item.subItems!.map((sub) => {
                        const subActive = isPathActive(sub.url);
                        return (
                          <button
                            key={sub.url}
                            onClick={() => handleNav(sub.url)}
                            className={`w-full py-1.5 px-1 text-[9px] rounded-md transition-all duration-100 active:scale-95 ${
                              subActive
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-muted-foreground/70 hover:text-foreground hover:bg-sidebar-accent/40"
                            }`}
                          >
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
