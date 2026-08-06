import { useState } from "react";
import { Calculator, BarChart3 } from "lucide-react";

type Filtro = "fisico" | "full" | "armazens";

export default function RelatorioEstoque() {
  const [filtro, setFiltro] = useState<Filtro>("fisico");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Relatório Estoque</h1>
        <p className="text-sm text-muted-foreground">
          Custo médio calculado pelas NFs de entrada (soma total ÷ quantidade).
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            { id: "fisico", label: "Físico" },
            { id: "full", label: "FULL" },
            { id: "armazens", label: "Armazéns" },
          ] as { id: Filtro; label: string }[]
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtro === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Calculator className="h-4 w-4" />
          <span className="text-sm">Custo médio por NF</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Exemplo: 10 un × R$50 (mês passado) + 10 un × R$60 (este mês) = R$1.100 ÷ 20 = R$55,00 por unidade.
        </p>
        <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-60" />
          Dados do relatório de {filtro === "fisico" ? "estoque físico" : filtro === "full" ? "FULL" : "armazéns"} aparecerão aqui.
        </div>
      </div>
    </div>
  );
}
