import { BarChart3, FileUp, PlusCircle } from "lucide-react";

const exemploNf = [
  { fornecedor: "Distribuidora Exemplo LTDA", valor: "1.250,00", data: "05/08/2026", categoria: "Compra de mercadorias" },
  { fornecedor: "Energia Elétrica", valor: "380,50", data: "01/08/2026", categoria: "Utilidades" },
];

const exemploContas = [
  { nome: "Aluguel", valor: "2.000,00", data: "10/08/2026", descricao: "Aluguel do mês" },
  { nome: "Internet", valor: "120,00", data: "15/08/2026", descricao: "Fibra óptica" },
];

export default function RelatorioDespesas() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatório Despesas</h1>
        <p className="text-sm text-muted-foreground">
          Exibição consolidada das NFs de fornecedores e contas cadastradas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm">Total do período</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">—</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileUp className="h-4 w-4" />
            <span className="text-sm">NFs de fornecedores</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">—</p>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <PlusCircle className="h-4 w-4" />
            <span className="text-sm">Contas cadastradas</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">—</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="border-b px-5 py-3 text-sm font-semibold text-foreground">
            NFs de Fornecedores
          </div>
          {exemploNf.map((nf) => (
            <div key={nf.fornecedor} className="flex items-center justify-between gap-2 border-b last:border-0 px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{nf.fornecedor}</p>
                <p className="text-xs text-muted-foreground">{nf.categoria} • {nf.data}</p>
              </div>
              <span className="font-semibold text-foreground">R$ {nf.valor}</span>
            </div>
          ))}
        </section>

        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="border-b px-5 py-3 text-sm font-semibold text-foreground">
            Contas Cadastradas
          </div>
          {exemploContas.map((c) => (
            <div key={c.nome} className="flex items-center justify-between gap-2 border-b last:border-0 px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.descricao} • {c.data}</p>
              </div>
              <span className="font-semibold text-foreground">R$ {c.valor}</span>
            </div>
          ))}
        </section>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        A consolidação real (NFs de fornecedores importadas + contas a pagar) será conectada aqui.
      </div>
    </div>
  );
}
