import { LayoutDashboard, Package, ShoppingBag, Warehouse, Users, TrendingUp, ArrowRightLeft, FileText, ScanBarcode, Monitor } from "lucide-react";
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

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const stats = [
    { label: "Produtos", value: totalProducts.toString(), icon: Package, color: "text-primary", bg: "bg-primary/10" },
    { label: "Vendas Hoje", value: formatCurrency(salesStats?.revenueToday ?? 0), icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
    { label: "Vendas (30d)", value: (salesStats?.sales30d ?? 0).toString(), icon: ShoppingBag, color: "text-warning", bg: "bg-warning/10" },
    { label: "Clientes", value: (customerStats?.total ?? 0).toString(), icon: Users, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral do sistema ERP</p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover-lift">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-xl ${stat.bg} p-3`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                <p className="text-[22px] font-extrabold text-foreground mt-0.5 leading-tight">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Módulos</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {modules.map((mod) => (
            <Link key={mod.title} to={mod.url}>
              <Card className="hover-lift cursor-pointer group">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-xl bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                    <mod.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{mod.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{mod.desc}</p>
                  </div>
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
