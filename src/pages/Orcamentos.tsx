import { useState } from "react";
import { FileText, Plus, ShoppingCart, Search } from "lucide-react";

interface ItemOrcamento {
  id: string;
  descricao: string;
  quantidade: number;
  preco: number;
}

export default function Orcamentos() {
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [cliente, setCliente] = useState("");

  const total = itens.reduce((acc, i) => acc + i.quantidade * i.preco, 0);

  const adicionar = () => {
    if (!descricao.trim() || !preco) return;
    setItens((prev) => [
      ...prev,
      { id: crypto.randomUUID(), descricao, quantidade: 1, preco: Number(preco) },
    ]);
    setDescricao("");
    setPreco("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orçamento</h1>
        <p className="text-sm text-muted-foreground">
          Crie orçamentos com opção de conversão direta em venda registrada.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Cliente</label>
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome do cliente (opcional)"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Adicionar item</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Buscar produto…"
                className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <input
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              placeholder="Preço"
              type="number"
              className="w-28 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={adicionar}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        {itens.length > 0 && (
          <div className="rounded-lg border divide-y">
            {itens.map((i) => (
              <div key={i.id} className="px-4 py-2 flex items-center gap-2 text-sm">
                <span className="flex-1 text-foreground">{i.descricao}</span>
                <span className="text-muted-foreground">× {i.quantidade}</span>
                <span className="font-medium text-foreground">
                  R$ {(i.quantidade * i.preco).toFixed(2)}
                </span>
                <button
                  onClick={() => setItens((prev) => prev.filter((p) => p.id !== i.id))}
                  className="text-xs text-destructive hover:underline"
                >
                  remover
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            Total: R$ {total.toFixed(2)}
          </span>
          <div className="flex gap-2">
            <button
              disabled={itens.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              <FileText className="h-4 w-4" /> Salvar Orçamento
            </button>
            <button
              disabled={itens.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <ShoppingCart className="h-4 w-4" /> Converter em Venda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}