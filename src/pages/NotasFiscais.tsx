import { useState } from "react";
import { FileEdit, ShieldCheck } from "lucide-react";

export default function NotasFiscais() {
  const [produto, setProduto] = useState("");
  const [fiscal, setFiscal] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nota Fiscal</h1>
        <p className="text-sm text-muted-foreground">
          Liste as vendas e aplique dados fiscais ao selecionar um item.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Venda / Produto</label>
          <input
            value={produto}
            onChange={(e) => setProduto(e.target.value)}
            placeholder="Selecione a venda e o produto"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Dados fiscais / Regra fiscal</label>
          <textarea
            value={fiscal}
            onChange={(e) => setFiscal(e.target.value)}
            rows={5}
            placeholder="Preencha os dados fiscais ou aplique uma regra fiscal"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-foreground">
            <FileEdit className="h-4 w-4" /> Salvar dados
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <ShieldCheck className="h-4 w-4" /> Aplicar regra fiscal
          </button>
        </div>
      </div>
    </div>
  );
}
