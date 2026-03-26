import { LayoutDashboard, Package, ShoppingBag, Warehouse, Users, TrendingUp, ArrowRightLeft, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const modules = [
  { title: "Produtos", desc: "Cadastro e gestão", icon: Package, url: "/produtos", count: "0" },
  { title: "Entrada XML", desc: "Importar notas", icon: FileText, url: "/entrada-xml", count: "0" },
  { title: "Estoque", desc: "Físico + FULL", icon: Warehouse, url: "/estoque", count: "0" },
  { title: "Envio FULL", desc: "Movimentações", icon: ArrowRightLeft, url: "/movimentacao-full", count: "0" },
  { title: "Vendas ML", desc: "Mercado Livre", icon: ShoppingBag, url: "/integracao-ml", count: "0" },
  { title: "Clientes", desc: "CRM", icon: Users, url: "/crm", count: "0" },
];

const Index = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema ERP</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Produtos", value: "0", icon: Package, trend: "+0%" },
          { label: "Vendas Hoje", value: "R$ 0", icon: TrendingUp, trend: "+0%" },
          { label: "Estoque Total", value: "0", icon: Warehouse, trend: "0" },
          { label: "Clientes", value: "0", icon: Users, trend: "+0" },
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
        <div className="grid gap-4 md:grid-cols-3">
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
