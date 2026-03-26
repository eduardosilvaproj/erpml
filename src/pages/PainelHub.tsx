import { LayoutDashboard, ShoppingBag, Package, AlertTriangle, Warehouse, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PainelHub = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel HUB</h1>
        <p className="text-muted-foreground">Visão geral de pedidos, produtos e estoque</p>
      </div>

      {/* Pedidos */}
      <div>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Pedidos
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Novos", value: "0", badge: "Pendente" },
            { label: "Enviados", value: "0", badge: "Em trânsito" },
            { label: "Entregues", value: "0", badge: "Concluído" },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="text-3xl font-bold">{item.value}</p>
                </div>
                <Badge variant="secondary">{item.badge}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Estoque */}
      <div>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <Warehouse className="h-5 w-5" />
          Estoque
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Físico</p>
              <p className="text-3xl font-bold text-primary">0</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">FULL</p>
              <p className="text-3xl font-bold text-accent">0</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-3xl font-bold">0</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p>Nenhum alerta no momento</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PainelHub;
