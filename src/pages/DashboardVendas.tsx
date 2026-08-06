import { TrendingUp, AlertTriangle } from "lucide-react";

export default function DashboardVendas() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard de Vendas</h1>
        <p className="text-sm text-muted-foreground">
          Exemplo no padrão Metrify — desenvolvimento futuro.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-sm text-amber-600 flex flex-col items-center gap-2">
        <AlertTriangle className="h-8 w-8" />
        <p>Módulo em desenvolvimento futuro.</p>
        <p className="text-xs text-muted-foreground">
          Aqui entrarão métricas de vendas, faturamento e comparações.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {["Faturamento", "Pedidos", "Ticket médio"].map((t) => (
          <div key={t} className="rounded-xl border bg-card p-6 text-center">
            <TrendingUp className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t}</p>
            <p className="text-2xl font-bold text-foreground">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}