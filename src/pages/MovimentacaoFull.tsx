import { ArrowRight, ScanBarcode, Package, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MovimentacaoFull = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Movimentação Físico → FULL</h1>
        <p className="text-muted-foreground">Envie produtos do estoque físico para o FULL Mercado Livre</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Separando", value: "0", variant: "secondary" as const },
          { label: "Enviado", value: "0", variant: "secondary" as const },
          { label: "Recebido FULL", value: "0", variant: "secondary" as const },
          { label: "Conferido FULL", value: "0", variant: "secondary" as const },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <Badge variant={stat.variant}>{stat.label}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" />
            Bipar Produtos para Envio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2">
                <Package className="h-5 w-5 text-primary" />
                <span className="font-medium">Físico</span>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-2">
                <Truck className="h-5 w-5 text-accent" />
                <span className="font-medium">FULL</span>
              </div>
            </div>
            <Input
              placeholder="Bipe o código de barras do produto..."
              className="max-w-md text-center text-lg"
              autoFocus
            />
            <Button disabled>
              Criar Ordem de Envio (0 itens)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MovimentacaoFull;
