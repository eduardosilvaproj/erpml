import { useState } from "react";
import {
  Home, Package, Warehouse, Store, TrendingUp, Brain,
  LogOut, ShieldCheck, Crown, ChevronDown, Boxes, UsersRound,
  Users, ClipboardList, ScanBarcode, Monitor, Megaphone,
  Building2, BarChart3, ShoppingBag, BarChart
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, usePendingUsers } from "@/hooks/useAdminData";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";

// Re-export types and data for backward compat
export type { MenuItem, MenuGroup } from "@/lib/menu-data";
export { menuGroups } from "@/lib/menu-data";

interface SubItem {
  label: string;
  url: string;
  icon: any;
}

interface NavGroup {
  label: string;
  icon: any;
  subItems: SubItem[];
}

const groups: NavGroup[] = [
  {
    label: "Cadastros", icon: Package,
    subItems: [
      { label: "Produtos", url: "/produtos", icon: Package },
      { label: "Kits", url: "/kits", icon: Boxes },
      { label: "Equipe", url: "/equipe", icon: UsersRound },
      { label: "Clientes", url: "/crm", icon: Users },
    ],
  },
  {
    label: "Estoque", icon: Warehouse,
    subItems: [
      { label: "Ver Estoque", url: "/estoque", icon: Warehouse },
      { label: "Entrada de Nota", url: "/entrada-nota", icon: ClipboardList },
      { label: "Conferência", url: "/conferencia", icon: ScanBarcode },
      { label: "Balanço", url: "/balanco-estoque", icon: BarChart },
    ],
  },
  {
    label: "Vendas", icon: Store,
    subItems: [
      { label: "PDV", url: "/pdv", icon: Monitor },
      { label: "Campanhas", url: "/campanhas", icon: Megaphone },
      { label: "Integrações", url: "/integracao-ml", icon: ShoppingBag },
    ],
  },
  {
    label: "Gestão", icon: TrendingUp,
    subItems: [
      { label: "Minha Empresa", url: "/empresa", icon: Building2 },
      { label: "Relatórios", url: "/painel-hub", icon: BarChart3 },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: pendingUsers } = usePendingUsers(!!isAdmin);
  const pendingCount = isAdmin ? (pendingUsers?.length || 0) : 0;
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const toggleGroup = (label: string) => {
    setOpenGroup(openGroup === label ? null : label);
  };

  const go = (url: string) => navigate(url);

  // Active style for main items
  const mainActiveClass = "bg-primary/15 text-primary font-semibold border-l-[3px] border-primary";
  const mainDefaultClass = "border-l-[3px] border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground";

  return (
    <aside className="w-[220px] min-w-[220px] h-screen sticky top-0 border-r border-border/40 bg-sidebar flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border/30 shrink-0">
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <span className="text-base font-bold text-primary">E</span>
        </div>
        <span className="text-sm font-bold text-foreground tracking-tight">ERP System</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin">
        {/* Início */}
        <button
          onClick={() => { setOpenGroup(null); go("/"); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-150 ${
            isActive("/") ? mainActiveClass : mainDefaultClass
          }`}
        >
          <Home className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} />
          <span>Início</span>
        </button>

        {/* Groups */}
        {groups.map((group) => {
          const isOpen = openGroup === group.label;
          const groupActive = group.subItems.some((s) => isActive(s.url));

          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-150 ${
                  groupActive && !isOpen
                    ? mainActiveClass
                    : isOpen
                      ? "bg-muted/60 text-foreground font-semibold border-l-[3px] border-muted-foreground/30"
                      : mainDefaultClass
                }`}
              >
                <group.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 opacity-50 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Sub-items */}
              {isOpen && (
                <div className="mt-1 mb-1.5 ml-4 pl-4 border-l-2 border-border/40 space-y-0.5">
                  {group.subItems.map((sub) => {
                    const subActive = isActive(sub.url);
                    return (
                      <button
                        key={sub.url}
                        onClick={() => go(sub.url)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all duration-100 ${
                          subActive
                            ? "text-primary font-semibold bg-primary/8"
                            : "text-muted-foreground hover:text-primary hover:bg-muted/30"
                        }`}
                      >
                        <sub.icon className={`h-4 w-4 shrink-0 ${subActive ? "text-primary" : ""}`} strokeWidth={1.75} />
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* IA */}
        <button
          onClick={() => { setOpenGroup(null); go("/ia-hub"); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-150 ${
            isActive("/ia-hub") || isActive("/ia-") ? mainActiveClass : mainDefaultClass
          }`}
        >
          <Brain className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} />
          <span>Central de IA</span>
        </button>

        {/* Admin */}
        {isAdmin && (
          <>
            <div className="mx-3 h-px bg-border/30 my-2" />
            <button
              onClick={() => { setOpenGroup(null); go("/admin"); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-150 ${
                isActive("/admin") ? mainActiveClass : mainDefaultClass
              }`}
            >
              <ShieldCheck className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} />
              <span>Admin</span>
            </button>
            <button
              onClick={() => { setOpenGroup(null); go("/master-admin"); }}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all duration-150 ${
                isActive("/master-admin") ? mainActiveClass : mainDefaultClass
              }`}
            >
              <Crown className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} />
              <span>Master</span>
              {pendingCount > 0 && (
                <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground border-0 rounded-full">
                  {pendingCount}
                </Badge>
              )}
            </button>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/30 p-2 shrink-0">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
