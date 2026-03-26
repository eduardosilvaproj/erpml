import { FileText, Upload, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EntradaXML = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Entrada via XML</h1>
        <p className="text-muted-foreground">Importe notas fiscais e atualize estoque automaticamente</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Notas Importadas", value: "0", icon: FileText },
          { label: "Aguardando Conferência", value: "0", icon: AlertTriangle },
          { label: "Conferidas", value: "0", icon: CheckCircle },
          { label: "Divergentes", value: "0", icon: AlertTriangle },
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
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-16">
            <Upload className="mb-4 h-12 w-12 text-muted-foreground opacity-40" />
            <p className="mb-2 text-lg font-medium text-foreground">Arraste o XML da Nota Fiscal aqui</p>
            <p className="mb-4 text-sm text-muted-foreground">ou clique para selecionar o arquivo</p>
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Selecionar XML
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EntradaXML;
