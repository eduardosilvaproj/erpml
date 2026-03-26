import { ScanBarcode, CheckCircle, AlertTriangle, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Conferencia = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Conferência com Bip</h1>
        <p className="text-muted-foreground">Confira produtos recebidos via leitor de código de barras</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Aguardando", value: "0", icon: Package },
          { label: "Em Conferência", value: "0", icon: ScanBarcode },
          { label: "Conferidas", value: "0", icon: CheckCircle },
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" />
            Leitor de Código de Barras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8">
            <Input
              placeholder="Bipe o código de barras aqui..."
              className="max-w-md text-center text-lg"
              autoFocus
            />
            <p className="text-sm text-muted-foreground">
              Selecione uma nota fiscal para iniciar a conferência
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Conferencia;
