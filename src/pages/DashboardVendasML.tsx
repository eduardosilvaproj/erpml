import { BarChart3 } from "lucide-react";

export default function DashboardVendasML() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard de Vendas ML</h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada das vendas do Mercado Livre FULL.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">Vendas hoje</div>
          <div className="mt-1 text-2xl font-bold text-card-foreground">—</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">Vendas mês</div>
          <div className="mt-1 text-2xl font-bold text-card-foreground">—</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">Ticket médio</div>
          <div className="mt-1 text-2xl font-bold text-card-foreground">—</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm text-muted-foreground">Unidades vendidas</div>
          <div className="mt-1 text-2xl font-bold text-card-foreground">—</div>
        </div>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-60" />
        Dashboard em desenvolvimento. Integração com API do Mercado Livre será ativada em breve.
      </div>
    </div>
  );
}
