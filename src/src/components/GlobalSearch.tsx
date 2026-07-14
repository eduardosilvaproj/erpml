import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package, Boxes, UsersRound, Users, Warehouse, CameraIcon,
  ScanBarcode, ClipboardList, ArrowRightLeft, Monitor, Megaphone,
  ShoppingBag, BarChart3, TrendingUp, Search
} from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from "@/components/ui/command";

interface SearchItem {
  label: string;
  url: string;
  icon: React.ElementType;
  category: string;
  keywords?: string[];
}

const searchItems: SearchItem[] = [
  // Cadastros
  { label: "Novo produto", url: "/produtos", icon: Package, category: "Cadastros", keywords: ["criar", "adicionar", "new"] },
  { label: "Lista de produtos", url: "/produtos", icon: Package, category: "Cadastros", keywords: ["ver", "listar"] },
  { label: "Kits", url: "/kits", icon: Boxes, category: "Cadastros", keywords: ["compostos", "bundle"] },
  { label: "Equipe", url: "/equipe", icon: UsersRound, category: "Cadastros", keywords: ["membros", "time", "permissões"] },
  { label: "CRM / Clientes", url: "/crm", icon: Users, category: "Cadastros", keywords: ["perguntas", "clientes"] },
  // Estoque
  { label: "Ver estoque", url: "/estoque", icon: Warehouse, category: "Estoque", keywords: ["saldo", "físico", "full"] },
  { label: "Entrada XML", url: "/entrada-xml", icon: CameraIcon, category: "Estoque", keywords: ["importar", "xml"] },
  { label: "Entrada Nota", url: "/entrada-nota", icon: CameraIcon, category: "Estoque", keywords: ["nfe", "nota fiscal"] },
  { label: "Conferência", url: "/conferencia", icon: ScanBarcode, category: "Estoque", keywords: ["bip", "recebimento"] },
  { label: "Balanço", url: "/balanco-estoque", icon: ClipboardList, category: "Estoque", keywords: ["inventário"] },
  { label: "Envio FULL", url: "/movimentacao-full", icon: ArrowRightLeft, category: "Estoque", keywords: ["transferir"] },
  // Vendas
  { label: "PDV / Nova venda", url: "/pdv", icon: Monitor, category: "Vendas", keywords: ["caixa", "vender"] },
  { label: "Campanhas", url: "/campanhas", icon: Megaphone, category: "Vendas", keywords: ["anúncios", "massa"] },
  { label: "Integrações", url: "/integracao-ml", icon: ShoppingBag, category: "Vendas", keywords: ["mercado livre"] },
  // Gestão
  { label: "Minha Empresa", url: "/empresa", icon: TrendingUp, category: "Gestão", keywords: ["dados", "configurações"] },
  { label: "Relatórios", url: "/painel-hub", icon: BarChart3, category: "Gestão", keywords: ["métricas", "hub"] },
];

const quickAccess = searchItems.slice(0, 6);

export function GlobalSearch(): JSX.Element {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback((url: string) => {
    setOpen(false);
    navigate(url);
  }, [navigate]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground text-xs transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/50 bg-muted px-1.5 text-[10px] font-mono text-muted-foreground/70">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar módulos, ações ou configurações..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Acesso rápido">
            {quickAccess.map((item) => (
              <CommandItem
                key={item.url + item.label}
                onSelect={() => handleSelect(item.url)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <item.icon className="h-4 w-4 text-primary/70" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/60">{item.category}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          {["Cadastros", "Estoque", "Vendas", "Gestão"].map((cat) => (
            <CommandGroup key={cat} heading={cat}>
              {searchItems
                .filter((i) => i.category === cat)
                .map((item) => (
                  <CommandItem
                    key={item.url + item.label}
                    onSelect={() => handleSelect(item.url)}
                    keywords={item.keywords}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <item.icon className="h-4 w-4 text-primary/70" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60">{item.category}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
