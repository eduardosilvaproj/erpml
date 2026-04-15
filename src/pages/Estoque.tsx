import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Warehouse, Package, ArrowRightLeft, AlertTriangle, Search, Loader2,
  ShieldCheck, ShieldAlert, Pencil, Plus, Download, FileDown, ClipboardEdit,
  ArrowUpRight, ArrowDownLeft, RotateCcw, History
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useProducts, useCategories } from "@/hooks/useProductData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Estoque = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [onlyDivergent, setOnlyDivergent] = useState(false);
  const [validationSearch, setValidationSearch] = useState("");
  const [adjustDialog, setAdjustDialog] = useState<{ id: string; name: string; stock_physical: number; stock_full: number } | null>(null);
  const [adjustPhysical, setAdjustPhysical] = useState("");
  const [adjustFull, setAdjustFull] = useState("");

  const { data, isLoading, refetch } = useProducts({
    search: search || undefined,
    category_id: categoryFilter || undefined,
    page,
    pageSize: 50,
    sortBy: "name",
    sortOrder: "asc",
  });
  const { data: categories } = useCategories();

  const products = data?.products || [];

  const totalPhysical = products.reduce((s, p) => s + p.stock_physical, 0);
  const totalFull = products.reduce((s, p) => s + p.stock_full, 0);
  const lowStock = products.filter((p) => (p.stock_physical + p.stock_full) <= p.min_stock && p.min_stock > 0);

  const filtered = stockFilter === "low"
    ? products.filter((p) => (p.stock_physical + p.stock_full) <= p.min_stock && p.min_stock > 0)
    : stockFilter === "zero"
      ? products.filter((p) => p.stock_physical + p.stock_full === 0)
      : products;

  const handleAdjustSave = async () => {
    if (!adjustDialog) return;
    const updates: Record<string, number> = {};
    if (adjustPhysical !== "") updates.stock_physical = Number(adjustPhysical);
    if (adjustFull !== "") updates.stock_full = Number(adjustFull);
    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase.from("products").update(updates).eq("id", adjustDialog.id);
    if (error) {
      toast({ title: "Erro ao ajustar estoque", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Estoque ajustado!" });
      refetch();
    }
    setAdjustDialog(null);
    setAdjustPhysical("");
    setAdjustFull("");
  };

  const handleExportCSV = () => {
    if (products.length === 0) {
      toast({ title: "Nenhum produto para exportar", variant: "destructive" });
      return;
    }
    const headers = ["SKU", "Produto", "Categoria", "Físico", "FULL", "Total", "Mínimo", "Status"];
    const rows = products.map((p) => {
      const total = p.stock_physical + p.stock_full;
      const isZero = total === 0;
      const isLow = p.min_stock > 0 && total <= p.min_stock;
      const status = isZero ? "Zerado" : isLow ? "Baixo" : "Normal";
      return [p.sku, p.name, p.categories?.name || "", p.stock_physical, p.stock_full, total, p.min_stock, status].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estoque_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Relatório exportado!" });
  };

  // Mock recent movements for display
  const recentMovements = [
    { date: "15/04/2026", product: "Fone Bluetooth TWS", type: "entrada" as const, qty: 50, user: "Sistema (NF-e)" },
    { date: "14/04/2026", product: "Capa iPhone 15", type: "saida" as const, qty: -2, user: "PDV" },
    { date: "14/04/2026", product: "Película Galaxy S24", type: "ajuste" as const, qty: 10, user: "Admin" },
    { date: "13/04/2026", product: "Carregador USB-C 20W", type: "saida" as const, qty: -5, user: "ML FULL" },
    { date: "12/04/2026", product: "Mouse Gamer RGB", type: "entrada" as const, qty: 30, user: "Sistema (NF-e)" },
  ];

  const movementIcon = (type: string) => {
    if (type === "entrada") return <ArrowDownLeft className="h-4 w-4 text-emerald-500" />;
    if (type === "saida") return <ArrowUpRight className="h-4 w-4 text-destructive" />;
    return <RotateCcw className="h-4 w-4 text-amber-500" />;
  };

  const movementLabel = (type: string) => {
    if (type === "entrada") return "Entrada";
    if (type === "saida") return "Saída";
    return "Ajuste";
  };

  return (
    <div className="space-y-6">
      {/* Header with buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle de Estoque</h1>
          <p className="text-muted-foreground">Estoque Físico + FULL (Mercado Livre)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAdjustDialog({ id: "", name: "", stock_physical: 0, stock_full: 0 })}>
            <ClipboardEdit className="h-4 w-4 mr-1" /> Ajuste Manual
          </Button>
          <Button size="sm" onClick={() => navigate("/entrada-nota")}>
            <Plus className="h-4 w-4 mr-1" /> Nova Entrada
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Estoque Físico", value: totalPhysical, icon: Warehouse, color: "text-primary" },
          { label: "Estoque FULL", value: totalFull, icon: Package, color: "text-accent" },
          { label: "Total Geral", value: totalPhysical + totalFull, icon: ArrowRightLeft, color: "text-foreground" },
          { label: "Estoque Baixo", value: lowStock.length, icon: AlertTriangle, color: "text-destructive" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Product table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar produto no estoque..."
                className="pl-10"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={categoryFilter || "all"} onValueChange={(v) => { setCategoryFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="low">Estoque Baixo</SelectItem>
                <SelectItem value="zero">Sem Estoque</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Físico</TableHead>
                    <TableHead className="text-center">FULL</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Mínimo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Atualizado</TableHead>
                    <TableHead className="text-center w-10">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const total = p.stock_physical + p.stock_full;
                    const isLow = p.min_stock > 0 && total <= p.min_stock;
                    const isZero = total === 0;
                    return (
                      <TableRow
                        key={p.id}
                        className={
                          isZero
                            ? "bg-red-500/5 hover:bg-red-500/10"
                            : isLow
                              ? "bg-amber-500/5 hover:bg-amber-500/10"
                              : ""
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{p.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">{p.stock_physical}</TableCell>
                        <TableCell className="text-center font-bold text-accent">{p.stock_full}</TableCell>
                        <TableCell className="text-center font-bold">{total}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{p.min_stock}</TableCell>
                        <TableCell>
                          {isZero ? (
                            <Badge variant="destructive">Zerado</Badge>
                          ) : isLow ? (
                            <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">Baixo</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {new Date(p.updated_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setAdjustDialog({ id: p.id, name: p.name, stock_physical: p.stock_physical, stock_full: p.stock_full });
                              setAdjustPhysical(String(p.stock_physical));
                              setAdjustFull(String(p.stock_full));
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Warehouse className="mb-4 h-12 w-12 opacity-30" />
              <p>Nenhum item no estoque</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock rule info */}
      <Card>
        <CardContent className="p-4">
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm font-medium text-foreground">Regra de Estoque Duplo</p>
            <p className="text-xs text-muted-foreground mt-1">
              Vendas FULL não baixam do estoque físico • Vendas PDV baixam apenas do físico
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Validação de Estoque */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Validação de Estoque: Físico vs FULL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const allProds = data?.products || [];
            const totalPhys = allProds.reduce((s, p) => s + p.stock_physical, 0);
            const totalF = allProds.reduce((s, p) => s + p.stock_full, 0);
            const diff = totalPhys - totalF;
            const divergentCount = allProds.filter((p) => p.stock_physical !== p.stock_full).length;

            const validationFiltered = allProds
              .filter((p) => (onlyDivergent ? p.stock_physical !== p.stock_full : true))
              .filter((p) =>
                validationSearch
                  ? p.name.toLowerCase().includes(validationSearch.toLowerCase()) ||
                    p.sku.toLowerCase().includes(validationSearch.toLowerCase())
                  : true
              );

            return (
              <>
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  <Card><CardContent className="flex items-center gap-3 p-4"><Warehouse className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Total Físico</p><p className="text-xl font-bold">{totalPhys}</p></div></CardContent></Card>
                  <Card><CardContent className="flex items-center gap-3 p-4"><Package className="h-5 w-5 text-accent" /><div><p className="text-xs text-muted-foreground">Total FULL</p><p className="text-xl font-bold">{totalF}</p></div></CardContent></Card>
                  <Card><CardContent className="flex items-center gap-3 p-4"><ArrowRightLeft className={`h-5 w-5 ${diff !== 0 ? "text-destructive" : "text-emerald-600"}`} /><div><p className="text-xs text-muted-foreground">Diferença</p><p className={`text-xl font-bold ${diff !== 0 ? "text-destructive" : "text-emerald-600"}`}>{diff > 0 ? `+${diff}` : diff}</p></div></CardContent></Card>
                  <Card><CardContent className="flex items-center gap-3 p-4"><ShieldAlert className={`h-5 w-5 ${divergentCount > 0 ? "text-amber-600" : "text-emerald-600"}`} /><div><p className="text-xs text-muted-foreground">Com Divergência</p><p className="text-xl font-bold">{divergentCount}</p></div></CardContent></Card>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Buscar produto..." className="pl-10" value={validationSearch} onChange={(e) => setValidationSearch(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="only-divergent" checked={onlyDivergent} onCheckedChange={setOnlyDivergent} />
                    <Label htmlFor="only-divergent" className="text-sm cursor-pointer">Apenas divergentes</Label>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : validationFiltered.length > 0 ? (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-center">Físico</TableHead>
                          <TableHead className="text-center">FULL</TableHead>
                          <TableHead className="text-center">Diferença</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationFiltered.map((p) => {
                          const d = p.stock_physical - p.stock_full;
                          const hasDivergence = d !== 0;
                          return (
                            <TableRow key={p.id} className={hasDivergence ? "bg-destructive/5" : ""}>
                              <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell className="text-center font-bold text-primary">{p.stock_physical}</TableCell>
                              <TableCell className="text-center font-bold text-accent">{p.stock_full}</TableCell>
                              <TableCell className="text-center font-bold">
                                <span className={hasDivergence ? "text-destructive" : "text-emerald-600"}>{d > 0 ? `+${d}` : d}</span>
                              </TableCell>
                              <TableCell>
                                {hasDivergence ? (
                                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Divergente</Badge>
                                ) : (
                                  <Badge className="bg-emerald-500/15 text-emerald-700">OK</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ShieldCheck className="mb-2 h-8 w-8 opacity-30" />
                    <p className="text-sm">{onlyDivergent ? "Nenhum produto com divergência encontrado" : "Nenhum produto encontrado"}</p>
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* Recent movements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Últimas Movimentações
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-primary">
            Ver histórico completo
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentMovements.map((m, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
                {movementIcon(m.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.product}</p>
                  <p className="text-xs text-muted-foreground">{m.date} • {m.user}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {movementLabel(m.type)}
                </Badge>
                <span className={`font-bold text-sm tabular-nums ${m.qty > 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {m.qty > 0 ? `+${m.qty}` : m.qty}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Adjust dialog */}
      <Dialog open={!!adjustDialog} onOpenChange={(open) => !open && setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste de Estoque{adjustDialog?.name ? ` — ${adjustDialog.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Estoque Físico</Label>
              <Input type="number" min={0} value={adjustPhysical} onChange={(e) => setAdjustPhysical(e.target.value)} placeholder="Quantidade física" />
            </div>
            <div>
              <Label>Estoque FULL</Label>
              <Input type="number" min={0} value={adjustFull} onChange={(e) => setAdjustFull(e.target.value)} placeholder="Quantidade FULL" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)}>Cancelar</Button>
            <Button onClick={handleAdjustSave} disabled={!adjustDialog?.id}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Estoque;
