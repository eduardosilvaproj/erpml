import { LayoutDashboard, Package, ShoppingBag, Warehouse, Users, TrendingUp, ArrowRightLeft, FileText, ScanBarcode, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema ERP</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Produtos", value: totalProducts.toString(), icon: Package },
          { label: "Vendas Hoje", value: formatCurrency(salesStats?.revenueToday ?? 0), icon: TrendingUp },
          { label: "Vendas (30d)", value: (salesStats?.sales30d ?? 0).toString(), icon: ShoppingBag },
          { label: "Clientes", value: (customerStats?.total ?? 0).toString(), icon: Users },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Módulos</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {modules.map((mod) => (
            <Link key={mod.title} to={mod.url}>
              <Card className="transition-colors hover:border-primary/30 hover:shadow-md cursor-pointer">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <mod.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{mod.title}</p>
                    <p className="text-sm text-muted-foreground">{mod.desc}</p>
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
