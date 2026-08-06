import { useState } from "react";
import { ArrowRightLeft, ScanBarcode } from "lucide-react";

export default function TransferenciaArmazem() {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [ean, setEan] = useState("");
  const [itens, setItens] = useState<{ ean: string; qtd: string }[]>([]);

  const adicionar = () => {
    if (!ean.trim()) return;
    setItens((prev) => [...prev, { ean, qtd: "1" }]);
    setEan("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Transferir Estoque Armazém</h1>
        <p className="text-sm text-muted-foreground">
          Transferência entre armazéns via bipagem de EAN (sem filmagem).
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Origem</label>
            <select
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Selecione…</option>
              <option>Armazém 1 (Estoque Físico)</option>
              <option>Loja</option>
              <option>FULL</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Destino</label>
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Selecione…</option>
              <option>Armazém 1 (Estoque Físico)</option>
              <option>Loja</option>
              <option>FULL</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Bipar EAN</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionar()}
                placeholder="Bipa ou digite o EAN e aperte Enter"
                className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              onClick={adicionar}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Adicionar
            </button>
          </div>
        </div>

        {itens.length > 0 && (
          <div className="rounded-lg border divide-y">
            {itens.map((i, idx) => (
              <div key={idx} className="px-4 py-2 flex items-center gap-2 text-sm">
                <ScanBarcode className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono flex-1 text-foreground">{i.ean}</span>
                <input
                  value={i.qtd}
                  onChange={(e) =>
                    setItens((prev) =>
                      prev.map((p, i2) => (i2 === idx ? { ...p, qtd: e.target.value } : p))
                    )
                  }
                  className="w-16 rounded border bg-background px-2 py-1 text-sm text-center outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            ))}
          </div>
        )}

        <button
          disabled={!origem || !destino || origem === destino || itens.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Confirmar Transferência
        </button>
      </div>
    </div>
  );
}