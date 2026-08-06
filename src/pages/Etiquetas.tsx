import { useState } from "react";
import { Printer, Search, FileText } from "lucide-react";

export default function Etiquetas() {
  const [mode, setMode] = useState<"manual" | "produto">("manual");
  const [ean, setEan] = useState("");
  const [descricao, setDescricao] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerar Etiqueta</h1>
        <p className="text-sm text-muted-foreground">
          Crie etiquetas digitando EAN e descrição ou selecione um produto já cadastrado.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("manual")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "manual"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          Digitar EAN / Descrição
        </button>
        <button
          onClick={() => setMode("produto")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "produto"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          Selecionar Produto
        </button>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        {mode === "manual" ? (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">EAN</label>
              <input
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                placeholder="Digite o código EAN"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Descrição</label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Digite a descrição do produto"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Buscar produto</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Buscar por nome ou EAN…"
                className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione um produto cadastrado para gerar a etiqueta EAN com o título do produto.
            </p>
          </div>
        )}

        <button
          disabled={mode === "manual" && (!ean.trim() || !descricao.trim())}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          Gerar Etiqueta
        </button>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        <FileText className="mx-auto mb-2 h-8 w-8 opacity-60" />
        As etiquetas geradas aparecerão aqui para impressão.
      </div>
    </div>
  );
}
