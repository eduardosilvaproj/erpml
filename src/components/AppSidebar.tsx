import { useState } from "react";
import {
  Home, Package, Warehouse, Store, TrendingUp, Brain,
  LogOut, Crown, ChevronDown, Boxes, UsersRound,
  Users, ClipboardList, ScanBarcode, Monitor,
  Building2, BarChart3, ShoppingBag, DollarSign,
  LockKeyhole, Import, Activity, Undo2, FileText,
  Printer, Factory, Truck, Tags, Briefcase,
  QrCode, Sparkles, Lock, ArrowRightLeft, Settings
} from "lucide-react";

import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingUsers, useHasAdminAccess } from "@/hooks/useAdminData";
import { useAdminMasterDev } from "@/hooks/useAdminMasterDev";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { VersionBadge } from "@/components/VersionBadge";

// Re-export types and data for backward compat
export type { MenuItem, MenuGroup } from "@/lib/menu-data";
export { menuGroups } from "@/lib/menu-data";

interface SubItem {
  label: string;
  url: string;
  icon: React.ElementType;
  tooltip: string;
  locked?: boolean;
  soon?: boolean;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  color: string;
  tooltip: string;
  subItems: SubItem[];
  highlight?: boolean;
}

const groups: NavGroup[] = [
  {
    label: "Cadastros",
    icon: Package,
    color: "text-[#60A5FA]",
    tooltip: "Produtos, clientes, kits e entrada de notas",
    subItems: [
      { label: "Entrada NF XML", url: "/entrada-xml", icon: FileText, tooltip: "Leia XML da nota, encontre produto por EAN e lance estoque/financeiro" },
      { label: "Produtos", url: "/produtos", icon: Package, tooltip: "Cadastro de produtos com aba de dados fiscais e regras fiscais" },
      { label: "Devoluções", url: "/devolucoes", icon: Undo2, tooltip: "Abertura de devolução com filmagem e canal de origem" },
      { label: "Criar Kits", url: "/kits", icon: Boxes, tooltip: "Monte kits compostos" },
      { label: "Clientes", url: "/crm", icon: Users, tooltip: "Base de clientes e histórico de compras" },
      { label: "Gerar Etiqueta", url: "/etiquetas", icon: Printer, tooltip: "Gere etiquetas por EAN/descrição ou vinculadas a produtos" },
    ],
  },
  {
    label: "Estoque",
    icon: Warehouse,
    color: "text-[#34D399]",
    tooltip: "Controle de saldos, transferências e ajustes",
    subItems: [
      { label: "Ver Estoque", url: "/estoque", icon: Warehouse, tooltip: "Filtre por Físico, FULL e armazéns; detalhe kits" },
      { label: "Relatório Estoque", url: "/relatorio-estoque", icon: BarChart3, tooltip: "Custo médio por NF, filtrado por Físico/FULL/armazém" },
      { label: "Envio FULL", url: "/movimentacao-full", icon: Truck, tooltip: "Transferir mercadorias para o FULL do Mercado Livre" },
      { label: "Criar Armazém / Canal", url: "/armazens", icon: Factory, tooltip: "Cadastre depósitos e locais (Físico, Loja, Site, FULL)" },
      { label: "Transferir Estoque Armazém", url: "/transferencia-armazem", icon: ArrowRightLeft, tooltip: "Transferência via bipagem de EAN entre armazéns" },
      { label: "Ajuste de Estoque Manual", url: "/ajuste-estoque", icon: Tags, tooltip: "Ajuste quantidade com senha de Gerente" },
      { label: "Balanço", url: "/balanco-estoque", icon: ClipboardList, tooltip: "Inventário físico do estoque" },
    ],
  },
  {
    label: "Vendas · Armazém 1",
    icon: Store,
    color: "text-[#FB923C]",
    tooltip: "PDV, orçamentos e notas fiscais do estoque físico (Armazém 1)",
    subItems: [
      { label: "PDV", url: "/pdv", icon: Monitor, tooltip: "Venda por busca ou bipagem, com ou sem NF" },
      { label: "Orçamento", url: "/orcamentos", icon: Briefcase, tooltip: "Crie orçamentos e converta em venda" },
      { label: "Nota Fiscal", url: "/notas-fiscais", icon: FileText, tooltip: "Lista de vendas com preenchimento de dados fiscais" },
    ],
  },
  {
    label: "Gestão Mercado Livre",
    icon: ShoppingBag,
    color: "text-neutral-900",
    tooltip: "Anúncios, estoque FULL e integração ML",
    highlight: true,
    subItems: [
      { label: "Anúncios", url: "/anuncios-ml", icon: Tags, tooltip: "Vincule anúncios ao estoque FULL e baixa automática por venda" },
      { label: "Dashboard de Vendas", url: "/dashboard-vendas-ml", icon: BarChart3, tooltip: "Dashboard futuro no padrão Metrify", soon: true },
      { label: "Estoque FULL", url: "/estoque-full-ml", icon: Warehouse, tooltip: "Sincronize estoque FULL ML com o estoque do armazém" },
      { label: "Integração", url: "/integracao-ml", icon: ShoppingBag, tooltip: "Conexão e sincronização via API do Mercado Livre" },
    ],
  },
  {
    label: "Gestão",
    icon: TrendingUp,
    color: "text-[#A78BFA]",
    tooltip: "Empresa, equipe e relatórios",
    subItems: [
      { label: "Minha Empresa", url: "/empresa", icon: Building2, tooltip: "Dados e configurações da empresa" },
      { label: "Equipe", url: "/equipe", icon: UsersRound, tooltip: "Colaboradores e permissões" },
      { label: "Relatórios", url: "/painel-hub", icon: BarChart3, tooltip: "Relatórios consolidados e métricas" },
    ],
  },
  {
    label: "Financeiro",
    icon: DollarSign,
    color: "text-[#34D399]",
    tooltip: "Resumo, contas a pagar e despesas",
    subItems: [
      { label: "Resumo Financeiro", url: "/financeiro", icon: Activity, tooltip: "Sincronização API estilo Metrify + vendas do estoque físico" },
      { label: "Contas a Pagar", url: "/contas-pagar", icon: DollarSign, tooltip: "Cadastro de contas (nome, valor, data, descrição)" },
      { label: "Relatório Despesas", url: "/relatorio-despesas", icon: BarChart3, tooltip: "NFs de fornecedores e contas cadastradas" },
    ],
  },
  {
    label: "Canais de Venda",
    icon: Store,
    color: "text-[#94A3B8]",
    tooltip: "Gerencie Loja 2, Site, Revenda e conexões por token",
    subItems: [
      { label: "Gerenciar Canais", url: "/canais-venda", icon: Settings, tooltip: "Cadastre canais e conecte via token de acesso" },
      { label: "Loja 2", url: "#", icon: Lock, tooltip: "Em desenvolvimento futuro", locked: true },
      { label: "Site", url: "#", icon: Lock, tooltip: "Em desenvolvimento futuro", locked: true },
      { label: "Revenda", url: "#", icon: Lock, tooltip: "Em desenvolvimento futuro", locked: true },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { hasPlatformAdminAccess: isPlatformAdmin } = useHasAdminAccess();
  const { data: isAdminMasterDev } = useAdminMasterDev();

  const { data: pendingUsers } = usePendingUsers(!!isPlatformAdmin);
  const pendingCount = isPlatformAdmin ? (pendingUsers?.length || 0) : 0;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { openMobile, setOpenMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const toggleGroup = (label: string) => {
    setOpenGroup(openGroup === label ? null : label);
  };

  const go = (url: string) => {
    if (url === "#") return;
    navigate(url);
    if (isMobile) setOpenMobile(false);
  };

  // Mobile: overlay sidebar
  if (isMobile) {
    return (
      <>
        {openMobile && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpenMobile(false)}
          />
        )}
        <aside
          className={`fixed top-0 left-0 z-50 h-screen w-[260px] border-r border-border/40 bg-sidebar flex flex-col overflow-hidden transition-transform duration-300 ${
            openMobile ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarContent
            isActive={isActive}
            toggleGroup={toggleGroup}
            openGroup={openGroup}
            setOpenGroup={setOpenGroup}
            go={go}
            signOut={signOut}
            isPlatformAdmin={!!isPlatformAdmin}
            isAdminMasterDev={!!isAdminMasterDev}
            pendingCount={pendingCount}
            compact={false}
          />
        </aside>
      </>
    );
  }

  return (
    <aside className="w-[260px] min-w-[260px] lg:w-[260px] lg:min-w-[260px] md:w-[200px] md:min-w-[200px] h-screen sticky top-0 border-r border-border/40 bg-sidebar flex flex-col overflow-hidden">
      <SidebarContent
        isActive={isActive}
        toggleGroup={toggleGroup}
        openGroup={openGroup}
        setOpenGroup={setOpenGroup}
        go={go}
        signOut={signOut}
        isPlatformAdmin={!!isPlatformAdmin}
        isAdminMasterDev={!!isAdminMasterDev}
        pendingCount={pendingCount}
        compact={isCollapsed}
      />
    </aside>
  );
}

function SidebarContent({
  isActive,
  toggleGroup,
  openGroup,
  setOpenGroup,
  go,
  signOut,
  isPlatformAdmin,
  isAdminMasterDev,
  pendingCount,
  compact,
}: {
  isActive: (url: string) => boolean;
  toggleGroup: (label: string) => void;
  openGroup: string | null;
  setOpenGroup: (g: string | null) => void;
  go: (url: string) => void;
  signOut: () => void;
  isPlatformAdmin: boolean;
  isAdminMasterDev: boolean;
  pendingCount: number;
  compact: boolean;
}) {
  return (
    <>
      <div className={`sidebar-header shrink-0 ${compact ? 'justify-center !h-16' : ''}`}>
        {compact ? (
          <img
            src="/bipstock-logo-sm.png"
            alt="BipStock"
            style={{
              height: '32px',
              width: '32px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 8px hsl(205 100% 50% / 0.4))'
            }}
          />
        ) : (
          <img
            src="/bipstock-logo-sm.png"
            alt="BipStock"
            style={{
              height: '80px',
              width: '160px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 8px hsl(205 100% 50% / 0.4))'
            }}
          />
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-1.5 lg:space-y-2 scrollbar-thin">
        {/* Início */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { setOpenGroup(null); go("/"); }}
              className={`w-full min-h-[44px] lg:min-h-[48px] flex items-center gap-2 lg:gap-2.5 px-3 lg:px-3.5 py-2 lg:py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150 ${
                isActive("/")
                  ? "border border-primary/30 bg-primary/10 border-l-[3px] border-l-primary font-semibold text-primary"
                  : "border border-border bg-secondary/60 border-l-[3px] border-l-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Home className="h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 text-foreground" strokeWidth={1.75} />
              <span className="leading-tight">Início</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Voltar para o painel principal</TooltipContent>
        </Tooltip>

        {/* Groups */}
        {groups.map((group) => {
          const isOpen = openGroup === group.label;
          const groupActive = group.subItems.some((s) => s.url !== "#" && isActive(s.url));
          const hasLockedOnly = group.subItems.every((s) => s.locked);

          return (
            <div key={group.label}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    disabled={hasLockedOnly}
                    className={`w-full min-h-[44px] lg:min-h-[48px] flex items-center gap-2 lg:gap-2.5 px-3 lg:px-3.5 py-2 lg:py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150 ${
                      group.highlight
                        ? isOpen || groupActive
                          ? "border border-[#E6CF00] bg-[#FFE600] border-l-[3px] border-l-[#E6CF00] font-bold text-neutral-900 shadow-sm"
                          : "border border-[#E6CF00] bg-[#FFE600] border-l-[3px] border-l-[#E6CF00] font-semibold text-neutral-900 hover:bg-[#FFD900] hover:text-black"
                        : isOpen || groupActive
                          ? "border border-primary/30 bg-primary/10 border-l-[3px] border-l-primary font-semibold text-primary"
                          : "border border-border bg-secondary/60 border-l-[3px] border-l-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                    } ${hasLockedOnly ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {group.highlight ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0" fill="currentColor" aria-hidden="true">
                        <path d="M14.06 4.32L9.74 7.98l4.32 3.66-2.16 1.83-4.32-3.66-2.16 1.83 6.48 5.49 6.48-5.49-4.32-3.66 4.32-3.66-2.16-1.83-4.32 3.66-2.16-1.83z"/>
                      </svg>
                    ) : (
                      <group.icon className={`h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 ${group.color}`} strokeWidth={1.75} />
                    )}
                    <span className="flex-1 text-left leading-snug text-pretty break-words">{group.label}</span>
                    {hasLockedOnly && (
                      <Lock className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    )}
                    {group.subItems.some((s) => s.soon) && !hasLockedOnly && (
                      <Sparkles className={`h-3.5 w-3.5 shrink-0 ${group.highlight ? "opacity-80" : "opacity-50"}`} />
                    )}
                    <ChevronDown
                      className={`h-3.5 w-3.5 lg:h-4 lg:w-4 shrink-0 transition-transform duration-200 ${
                        group.highlight ? "opacity-70" : "opacity-40"
                      } ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{group.tooltip}</TooltipContent>
              </Tooltip>

              {isOpen && (
                <div className="mt-1 lg:mt-1.5 ml-2 lg:ml-3 space-y-[2px]">
                  {group.subItems.map((sub) => {
                    const subActive = sub.url !== "#" && isActive(sub.url);
                    return (
                      <Tooltip key={sub.label}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => go(sub.url)}
                            disabled={sub.locked}
                            className={`w-full flex items-center gap-2 lg:gap-2.5 px-3 lg:px-3.5 py-2 rounded-lg text-[13px] font-medium text-left transition-all duration-100 border-l border-border/60 ${
                              subActive
                                ? "text-primary font-semibold"
                                : "text-muted-foreground hover:text-primary"
                            } ${sub.locked ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <sub.icon className={`h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 ${subActive ? "text-primary" : ""}`} strokeWidth={1.75} />
                            <span className="flex-1 leading-snug text-pretty break-words">{sub.label}</span>
                            {sub.locked && (
                              <Lock className="h-3 w-3 ml-auto shrink-0 opacity-50" />
                            )}
                            {sub.soon && !sub.locked && (
                              <Sparkles className="h-3 w-3 ml-auto shrink-0 opacity-50" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">{sub.tooltip}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Central de IA - tela direta */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { setOpenGroup(null); go("/ia-hub"); }}
              className={`w-full min-h-[44px] lg:min-h-[48px] flex items-center gap-2 lg:gap-2.5 px-3 lg:px-3.5 py-2 lg:py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150 ${
                isActive("/ia-hub") || isActive("/ia-")
                  ? "border border-primary/30 bg-primary/10 border-l-[3px] border-l-primary font-semibold text-primary"
                  : "border border-border bg-secondary/60 border-l-[3px] border-l-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Brain className="h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 text-[#F472B6]" strokeWidth={1.75} />
              <span className="leading-tight">Central de IA</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Ferramentas inteligentes para otimizar seu negócio</TooltipContent>
        </Tooltip>

        {/* Admin / Governance */}
        {isPlatformAdmin && (
          <>
            <div className="mx-2 h-px bg-border/20 my-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setOpenGroup(null); go("/master-admin"); }}
                  className={`relative w-full min-h-[44px] lg:min-h-[48px] flex items-center gap-2 lg:gap-2.5 px-3 lg:px-3.5 py-2 lg:py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150 ${
                    isActive("/master-admin")
                      ? "border border-primary/30 bg-primary/10 border-l-[3px] border-l-primary font-semibold text-primary"
                      : "border border-border bg-secondary/60 border-l-[3px] border-l-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Crown className="h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 text-amber-400" strokeWidth={1.75} />
                  <span className="leading-tight">Governança</span>
                  {pendingCount > 0 && (
                    <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground border-0 rounded-full">
                      {pendingCount}
                    </Badge>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Governança da plataforma</TooltipContent>
            </Tooltip>
          </>
        )}

        {isAdminMasterDev && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { setOpenGroup(null); go("/admin-master-dev"); }}
                className={`w-full min-h-[44px] lg:min-h-[48px] flex items-center gap-2 lg:gap-2.5 px-3 lg:px-3.5 py-2 lg:py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-150 ${
                  isActive("/admin-master-dev")
                    ? "border border-primary/30 bg-primary/10 border-l-[3px] border-l-primary font-semibold text-primary"
                    : "border border-border bg-secondary/60 border-l-[3px] border-l-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <LockKeyhole className="h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0 text-primary" strokeWidth={1.75} />
                <span className="leading-tight">Admin Master (Dev)</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Painel de Controle e QA</TooltipContent>
          </Tooltip>
        )}
      </nav>

      <div className="border-t border-border/30 p-2 lg:p-3 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={signOut}
              className="w-full min-h-[44px] lg:min-h-[48px] flex items-center gap-2 lg:gap-2.5 px-3 lg:px-3.5 py-2 lg:py-2.5 rounded-xl text-sm font-medium text-left border border-border bg-secondary/60 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4 lg:h-[18px] lg:w-[18px] shrink-0" strokeWidth={1.75} />
              <span className="leading-tight">Sair</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Encerrar sessão e sair do sistema</TooltipContent>
        </Tooltip>
        <div className="mt-1 text-center">
          <VersionBadge />
        </div>
      </div>
    </>
  );
}
