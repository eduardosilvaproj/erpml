import { useState } from "react";
import { Lock, Package, Minus, Plus } from "lucide-react";

export default function AjusteEstoque() {
  const [produto, setProduto] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [senha, setSenha] = useState("");
  const [confirmado, setConfirmado] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ajuste de Estoque Manual</h1>
        <p className="text-sm text-muted-foreground">
          Ajuste de quantidade liberado apenas com senha do Gerente.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4 max-w-xl">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Produto</label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              placeholder="Buscar produto por nome ou EAN…"
              className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Quantidade</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantidade((q) => Math.max(0, q - 1))}
              className="rounded-lg border p-2 text-muted-foreground hover:bg-muted"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
              className="w-24 rounded-lg border bg-background px-3 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={() => setQuantidade((q) => q + 1)}
              className="rounded-lg border p-2 text-muted-foreground hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Lock className="h-4 w-4" /> Senha do Gerente
          </label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Digite a senha para liberar o ajuste"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <button
          disabled={!produto.trim() || !senha.trim()}
          onClick={() => setConfirmado(true)}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Confirmar Ajuste
        </button>

        {confirmado && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
            Ajuste confirmado com autorização do gerente.
          </p>
        )}
      </div>
    </div>
  );
}