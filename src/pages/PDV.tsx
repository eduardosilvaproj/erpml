import { ScanBarcode, ShoppingCart, CreditCard, Banknote, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const PDV = () => {
  return (
    <div className="grid h-[calc(100vh-6rem)] gap-4 md:grid-cols-3">
      {/* Left: Product scan */}
      <div className="md:col-span-2 space-y-4">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanBarcode className="h-5 w-5" />
              Ponto de Venda
            </CardTitle>
            <Input
              placeholder="Bipe ou digite o código de barras..."
              className="text-lg"
              autoFocus
            />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <ShoppingCart className="mb-4 h-16 w-16 opacity-20" />
            <p className="text-lg">Carrinho vazio</p>
            <p className="text-sm">Bipe um produto para começar a venda</p>
          </CardContent>
        </Card>
      </div>

      {/* Right: Cart summary */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Resumo da Venda</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          <div className="text-muted-foreground text-center py-8">
            <p className="text-sm">Nenhum item</p>
          </div>
          <div className="space-y-4">
            <Separator />
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span>R$ 0,00</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="flex flex-col gap-1 h-auto py-3" disabled>
                <Banknote className="h-5 w-5" />
                <span className="text-xs">Dinheiro</span>
              </Button>
              <Button variant="outline" className="flex flex-col gap-1 h-auto py-3" disabled>
                <Smartphone className="h-5 w-5" />
                <span className="text-xs">Pix</span>
              </Button>
              <Button variant="outline" className="flex flex-col gap-1 h-auto py-3" disabled>
                <CreditCard className="h-5 w-5" />
                <span className="text-xs">Cartão</span>
              </Button>
            </div>
            <Button className="w-full" size="lg" disabled>
              Finalizar Venda
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PDV;
