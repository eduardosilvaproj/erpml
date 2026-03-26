import { Warehouse, Package, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const Estoque = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Controle de Estoque</h1>
        <p className="text-muted-foreground">Estoque Físico + FULL (Mercado Livre)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Estoque Físico", value: "0", icon: Warehouse, color: "text-primary" },
          { label: "Estoque FULL", value: "0", icon: Package, color: "text-accent" },
          { label: "Total Geral", value: "0", icon: ArrowRightLeft, color: "text-foreground" },
          { label: "Estoque Baixo", value: "0", icon: AlertTriangle, color: "text-destructive" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exemplo de Estoque Duplo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Físico</p>
                <p className="text-3xl font-bold text-primary">120</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">FULL</p>
                <p className="text-3xl font-bold text-accent">50</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-3xl font-bold">170</p>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Vendas FULL não baixam do estoque físico
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar produto no estoque..." className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Warehouse className="mb-4 h-12 w-12 opacity-30" />
            <p>Nenhum item no estoque</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Estoque;
