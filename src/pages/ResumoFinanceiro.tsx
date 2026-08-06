import { DollarSign, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";

export default function ResumoFinanceiro() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resumo Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Sincronização via API (estilo Metrify) + vendas do estoque físico.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-4 w-4" />
            <span className="text-sm">Saldo</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">—</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-emerald-500">
            <ArrowUpRight className="h-4 w-4" />
            <span className="text-sm">Entradas</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">—</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-red-500">
            <ArrowDownRight className="h-4 w-4" />
            <span className="text-sm">Saídas</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">—</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        <DollarSign className="mx-auto mb-2 h-8 w-8 opacity-60" />
        Dados consolidados da API (Metrify) e vendas físicas aparecerão aqui.
      </div>
    </div>
  );
}