import {
  Package, Boxes, UsersRound, Users, Warehouse, CameraIcon,
  ScanBarcode, ClipboardList, ArrowRightLeft, Monitor, Megaphone,
  ShoppingBag, Store, BarChart3, DollarSign, Sparkles, GraduationCap,
  Brain, TrendingUp
} from "lucide-react";
import type { MenuGroup } from "@/components/AppSidebar";

export const menuGroups: MenuGroup[] = [
  {
    label: "Cadastros",
    icon: Package,
    color: "text-blue-400",
    items: [
      { title: "Produtos", url: "/produtos", icon: Package, desc: "Cadastro e gestão de produtos" },
      { title: "Kits", url: "/kits", icon: Boxes, desc: "Monte kits compostos" },
      { title: "Equipe", url: "/equipe", icon: UsersRound, desc: "Membros e permissões" },
      { title: "CRM", url: "/crm", icon: Users, desc: "Clientes e perguntas ML" },
    ],
  },
  {
    label: "Estoque",
    icon: Warehouse,
    color: "text-emerald-400",
    items: [
      { title: "Estoque", url: "/estoque", icon: Warehouse, desc: "Saldo físico e FULL" },
      { title: "Entrada Nota", url: "/entrada-nota", icon: CameraIcon, desc: "Importar notas fiscais" },
      { title: "Conferência", url: "/conferencia", icon: ScanBarcode, desc: "Bip de recebimento" },
      { title: "Balanço", url: "/balanco-estoque", icon: ClipboardList, desc: "Inventário físico" },
      { title: "Envio FULL", url: "/movimentacao-full", icon: ArrowRightLeft, desc: "Transferir para FULL", premium: true },
    ],
  },
  {
    label: "Vendas",
    icon: Store,
    color: "text-amber-400",
    items: [
      { title: "PDV", url: "/pdv", icon: Monitor, desc: "Ponto de venda" },
      { title: "Campanhas", url: "/campanhas", icon: Megaphone, desc: "Anúncios em massa" },
      { title: "Integração ML", url: "/integracao-ml", icon: ShoppingBag, desc: "Mercado Livre", premium: true },
      { title: "Minha Loja", url: "/minha-loja/configurar", icon: Store, desc: "Vitrine virtual" },
    ],
  },
  {
    label: "Gestão",
    icon: TrendingUp,
    color: "text-violet-400",
    items: [
      { title: "Painel HUB", url: "/painel-hub", icon: BarChart3, desc: "Relatórios e métricas", premium: true },
      { title: "Financeiro", url: "/financeiro", icon: DollarSign, desc: "Cobranças e pagamentos", premium: true },
    ],
  },
  {
    label: "Inteligência",
    icon: Brain,
    color: "text-rose-400",
    items: [
      { title: "Central de IA", url: "/ia-hub", icon: Sparkles, desc: "Ferramentas de IA" },
      { title: "Mentor de Vendas", url: "/mentor-vendas", icon: GraduationCap, desc: "Crescimento guiado", premium: true },
    ],
  },
];
