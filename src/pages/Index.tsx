import { Package, ShoppingBag, Warehouse, Users, TrendingUp, ArrowRightLeft, FileText, ScanBarcode, Monitor, ArrowUpRight, ArrowDownRight, AlertTriangle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useProducts } from "@/hooks/useProductData";
import { useSalesStats } from "@/hooks/useSalesData";
import { useCustomerStats } from "@/hooks/useCustomerData";

const modules = [
  { title: "Produtos", desc: "Cadastro e gestão", icon: Package, url: "/produtos" },
  { title: "Entrada XML", desc: "Importar notas", icon: FileText, url: "/entrada-xml" },
  { title: "Conferência", desc: "Bip de recebimento", icon: ScanBarcode, url: "/conferencia" },
  { title: "Estoque", desc: "Físico + FULL", icon: Warehouse, url: "/estoque" },
  { title: "Envio FULL", desc: "Movimentações", icon: ArrowRightLeft, url: "/movimentacao-full" },
  { title: "PDV", desc: "Ponto de Venda", icon: Monitor, url: "/pdv" },
  { title: "CRM", desc: "Clientes", icon: Users, url: "/crm" },
  { title: "Vendas ML", desc: "Mercado Livre", icon: ShoppingBag, url: "/integracao-ml" },
];

const Index = () => {
  const { data: productData } = useProducts({ pageSize: 1 });
  const { data: salesStats } = useSalesStats();
  const { data: customerStats } = useCustomerStats();

  const totalProducts = productData?.total ?? 0;
  const revenueToday = salesStats?.revenueToday ?? 0;
  const sales30d = salesStats?.sales30d ?? 0;
  const totalCustomers = customerStats?.total ?? 0;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1.5">Visão geral do sistema ERP</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Atualizado agora</span>
        </div>
      </div>

      {/* KPI Cards - highlighted with unique accent colors */}
      <div className="grid gap-5 grid-cols-2 md:grid-cols-4">
        {/* Produtos */}
        <Card className="hover-lift border-l-[3px] border-l-primary">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Package className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Cadastrados
              </span>
            </div>
            <p className="text-[28px] font-extrabold text-foreground leading-none">{totalProducts}</p>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Produtos</p>
          </CardContent>
        </Card>

        {/* Vendas Hoje */}
        <Card className="hover-lift border-l-[3px] border-l-success">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="rounded-xl bg-success/10 p-2.5">
                <TrendingUp className="h-5 w-5 text-success" strokeWidth={1.75} />
              </div>
              {revenueToday > 0 ? (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                  <ArrowUpRight className="h-3 w-3" /> Ativo
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                  <ArrowDownRight className="h-3 w-3" /> Sem vendas
                </span>
              )}
            </div>
            <p className="text-[28px] font-extrabold text-foreground leading-none">{formatCurrency(revenueToday)}</p>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Vendas Hoje</p>
          </CardContent>
        </Card>

        {/* Vendas 30d */}
        <Card className="hover-lift border-l-[3px] border-l-warning">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="rounded-xl bg-warning/10 p-2.5">
                <ShoppingBag className="h-5 w-5 text-warning" strokeWidth={1.75} />
              </div>
              {sales30d > 0 ? (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                  <ArrowUpRight className="h-3 w-3" /> +{sales30d}
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-3 w-3" /> Nenhuma
                </span>
              )}
            </div>
            <p className="text-[28px] font-extrabold text-foreground leading-none">{sales30d}</p>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Vendas (30d)</p>
          </CardContent>
        </Card>

        {/* Clientes */}
        <Card className="hover-lift border-l-[3px] border-l-primary">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Users className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                Total
              </span>
            </div>
            <p className="text-[28px] font-extrabold text-foreground leading-none">{totalCustomers}</p>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1.5">Clientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Módulos */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">Módulos</h2>
          <span className="text-xs text-muted-foreground">{modules.length} disponíveis</span>
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {modules.map((mod) => (
            <Link key={mod.title} to={mod.url}>
              <Card className="hover-lift cursor-pointer group h-full">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-xl bg-primary/8 p-3 group-hover:bg-primary/20 transition-colors duration-200">
                    <mod.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{mod.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{mod.desc}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
