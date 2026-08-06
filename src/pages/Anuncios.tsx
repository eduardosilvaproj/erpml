import { useState } from "react";
import { Link2, ShoppingBag, Search } from "lucide-react";

export default function Anuncios() {
  const [anuncio, setAnuncio] = useState("");
  const [estoque, setEstoque] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Anúncios</h1>
        <p className="text-sm text-muted-foreground">
          Vincule anúncios ao estoque FULL. A venda pela API dá baixa automática no estoque.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Anúncio</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={anuncio}
              onChange={(e) => setAnuncio(e.target.value)}
              placeholder="Buscar anúncio do Mercado Livre…"
              className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Estoque FULL vinculado</label>
          <input
            value={estoque}
            onChange={(e) => setEstoque(e.target.value)}
            placeholder="Produto ou SKU enviado ao FULL"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Link2 className="h-4 w-4" /> Vincular anúncio
        </button>
      </div>

      <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        <ShoppingBag className="mx-auto mb-2 h-8 w-8 opacity-60" />
        Anúncios vinculados e saldo de baixa automática aparecerão aqui.
      </div>
    </div>
  );
}
