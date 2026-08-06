import { useState } from "react";
import { DollarSign, Plus, Trash2, CheckCircle2 } from "lucide-react";

interface Conta {
  id: string;
  nome: string;
  valor: string;
  data: string;
  descricao: string;
  pago: boolean;
}

export default function ContasPagar() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");

  const adicionar = () => {
    if (!nome.trim() || !valor.trim() || !data.trim()) return;
    setContas([
      ...contas,
      {
        id: crypto.randomUUID(),
        nome: nome.trim(),
        valor: valor.trim(),
        data: data.trim(),
        descricao: descricao.trim(),
        pago: false,
      },
    ]);
    setNome("");
    setValor("");
    setData("");
    setDescricao("");
  };

  const remover = (id: string) => setContas((c) => c.filter((x) => x.id !== id));
  const marcarPago = (id: string) =>
    setContas((c) => c.map((x) => (x.id === id ? { ...x, pago: !x.pago } : x)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contas a Pagar</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro de contas com nome, valor, data e descrição.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Plus className="h-4 w-4 text-primary" />
            Nova conta
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome"
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Valor (R$)"
              inputMode="decimal"
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição"
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button
            onClick={adicionar}
            disabled={!nome.trim() || !valor.trim() || !data.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            Adicionar conta
          </button>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <DollarSign className="h-4 w-4 text-primary" />
            Resumo
          </h2>
          <p className="mt-3 text-3xl font-bold text-foreground">
            {contas
              .filter((c) => !c.pago)
              .reduce((acc, c) => acc + (parseFloat(c.valor.replace(",", ".")) || 0), 0)
              .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="text-sm text-muted-foreground">total em aberto</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
          <span>Conta</span>
          <span className="text-right">Valor</span>
        </div>
        {contas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhuma conta cadastrada ainda.
          </p>
        ) : (
          contas.map((c) => (
            <div
              key={c.id}
              className={`grid grid-cols-[1fr_auto] gap-2 items-center px-5 py-3 border-b last:border-0 text-sm ${
                c.pago ? "opacity-50" : ""
              }`}
            >
              <div>
                <p className="font-medium text-foreground line-through decoration-muted-foreground/50">
                  {c.nome}
                  {c.descricao ? (
                    <span className="ml-2 text-muted-foreground font-normal">— {c.descricao}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(c.data + "T00:00:00").toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {parseFloat(c.valor.replace(",", ".") || "0").toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
                <button
                  onClick={() => marcarPago(c.id)}
                  title={c.pago ? "Reabrir conta" : "Marcar como paga"}
                  className={`rounded-md p-1.5 transition-colors ${
                    c.pago
                      ? "text-emerald-500 hover:bg-emerald-500/10"
                      : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remover(c.id)}
                  title="Remover conta"
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
