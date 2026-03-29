import { ShoppingBag, Link2, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const IntegracaoML = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integração Mercado Livre</h1>
          <p className="text-muted-foreground">Conecte e sincronize com sua conta ML</p>
        </div>
        <Button variant="outline" disabled>
          <Link2 className="mr-2 h-4 w-4" />
          Conectar Conta ML
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {[
          { label: "Vendas Hoje", value: "0", icon: ShoppingBag },
          { label: "Produtos Vinculados", value: "0", icon: Link2 },
          { label: "Sincronizações", value: "0", icon: RefreshCw },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-2">
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

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertTriangle className="mb-4 h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">Integração não configurada</p>
          <p className="text-sm">Conecte sua conta do Mercado Livre para começar</p>
          <p className="mt-2 text-xs">Será implementada em fase posterior</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegracaoML;
