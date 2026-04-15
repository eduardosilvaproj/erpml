import { useState } from "react";
import {
  Home, Package, Warehouse, Store, TrendingUp, Brain,
  LogOut, ShieldCheck, Crown, ChevronDown, Boxes, UsersRound,
  Users, ClipboardList, ScanBarcode, Monitor, Megaphone,
  Building2, BarChart3
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
    ],
  },
  {
    label: "Vendas", icon: Store,
    subItems: [
      { label: "PDV", url: "/pdv", icon: Monitor },
      { label: "Campanhas", url: "/campanhas", icon: Megaphone },
    ],
  },
  {
    label: "Gestão", icon: TrendingUp,
    subItems: [
      { label: "Minha Empresa", url: "/empresa", icon: Building2 },
      { label: "Painel HUB", url: "/painel-hub", icon: BarChart3 },
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
  const isMobile = useIsMobile();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const toggleGroup = (label: string) => {
    setOpenGroup(openGroup === label ? null : label);
  };

  const go = (url: string) => {
    navigate(url);
  };

  return (
    <aside className="w-[220px] min-w-[220px] h-screen sticky top-0 border-r border-border/40 bg-sidebar flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border/30 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <span className="text-sm font-bold text-primary">E</span>
        </div>
        <span className="text-sm font-bold text-foreground">ERP System</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
        {/* Início */}
        <button
          onClick={() => { setOpenGroup(null); go("/"); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            isActive("/")
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          <Home className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  groupActive && !isOpen
                    ? "bg-primary/10 text-primary font-medium"
                    : isOpen
                      ? "bg-muted/50 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <group.icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Sub-items */}
              {isOpen && (
                <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-border/30 space-y-0.5">
                  {group.subItems.map((sub) => {
                    const subActive = isActive(sub.url);
                    return (
                      <button
                        key={sub.url}
                        onClick={() => go(sub.url)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
                          subActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                        }`}
                      >
                        <sub.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
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
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            isActive("/ia-hub") || isActive("/ia-")
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          <Brain className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
          <span>Central de IA</span>
        </button>

        {/* Admin */}
        {isAdmin && (
          <>
            <div className="mx-3 h-px bg-border/30 my-2" />
            <button
              onClick={() => { setOpenGroup(null); go("/admin"); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive("/admin")
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <ShieldCheck className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
              <span>Admin</span>
            </button>
            <button
              onClick={() => { setOpenGroup(null); go("/master-admin"); }}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive("/master-admin")
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Crown className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
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
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
