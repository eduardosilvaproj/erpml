import { useState } from "react";
import { Warehouse, Plus, Factory } from "lucide-react";

type Tipo = "Físico" | "Loja" | "Site" | "FULL";

interface Armazem {
  id: string;
  nome: string;
  tipo: Tipo;
  endereco?: string;
}

export default function Armazens() {
  const [armazens, setArmazens] = useState<Armazem[]>([
    { id: "1", nome: "Armazém 1", tipo: "Físico", endereco: "Matriz" },
  ]);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<Tipo>("Físico");
  const [endereco, setEndereco] = useState("");

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setArmazens((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nome, tipo, endereco },
    ]);
    setNome("");
    setEndereco("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Criar Armazém / Canal</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre depósitos e locais (Físico, Loja, Site, FULL).
        </p>
      </div>

      <form onSubmit={salvar} className="rounded-xl border bg-card p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Loja Centro"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Tipo)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option>Físico</option>
              <option>Loja</option>
              <option>Site</option>
              <option>FULL</option>
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Endereço / Observação</label>
          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Ex: Rua Principal, 123"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Cadastrar
        </button>
      </form>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b px-6 py-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Warehouse className="h-4 w-4" />
          Armazéns cadastrados
        </div>
        <div className="divide-y">
          {armazens.map((a) => (
            <div key={a.id} className="px-6 py-3 flex items-center gap-3 text-sm">
              <Factory className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium text-foreground">{a.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {a.tipo} {a.endereco ? `• ${a.endereco}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
