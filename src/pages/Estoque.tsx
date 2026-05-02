import { useState, useMemo, useRef, useEffect } from "react";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useNavigate } from "react-router-dom";
import {
  Warehouse, Package, ArrowRightLeft, AlertTriangle, Search, Loader2,
  ShieldCheck, ShieldAlert, Pencil, Plus, Download, FileDown, ClipboardEdit,
  ArrowUpRight, ArrowDownLeft, RotateCcw, History, PackageOpen
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
import { useProductsInfinite, useCategories } from "@/hooks/useProductData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { StatusBadge } from "@/components/StatusBadge";
import { formatNumber, formatDifference } from "@/lib/formatters";
import { useVirtualizer } from "@tanstack/react-virtual";

const Estoque = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [onlyDivergent, setOnlyDivergent] = useState(false);
  const [validationSearch, setValidationSearch] = useState("");
  const [adjustDialog, setAdjustDialog] = useState<{ id: string; name: string; stock_physical: number; stock_full: number; gtin_cx?: string | null; box_quantity?: number | null } | null>(null);
  const [adjustPhysical, setAdjustPhysical] = useState("");
  const [adjustFull, setAdjustFull] = useState("");

  // Mode toggle
  const [adjustBoxMode, setAdjustBoxMode] = useState(false);
  const [adjustBoxGtinCx, setAdjustBoxGtinCx] = useState("");
  const [adjustBoxUnitsPerBox, setAdjustBoxUnitsPerBox] = useState("");
  const [adjustBoxCount, setAdjustBoxCount] = useState("");
  const [adjustBoxTarget, setAdjustBoxTarget] = useState<"physical" | "full">("physical");

  const filters = useMemo(() => ({
    search: search || undefined,
    category_id: categoryFilter || undefined,
    sortBy: "name",
    sortOrder: "asc" as const,
  }), [search, categoryFilter]);

  const { data, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useProductsInfinite(filters);
  const { data: categories } = useCategories();

  const allProducts = useMemo(() => data?.pages.flatMap(page => page.products) || [], [data]);

  const filtered = useMemo(() => {
    let result = allProducts;
    if (stockFilter === "low") {
      result = result.filter((p) => (p.stock_physical + p.stock_full) <= p.min_stock && p.min_stock > 0);
    } else if (stockFilter === "zero") {
      result = result.filter((p) => p.stock_physical + p.stock_full === 0);
    }
    return result;
  }, [allProducts, stockFilter]);

  const totalPhysical = useMemo(() => allProducts.reduce((s, p) => s + p.stock_physical, 0), [allProducts]);
  const totalFull = useMemo(() => allProducts.reduce((s, p) => s + p.stock_full, 0), [allProducts]);
  const lowStockCount = useMemo(() => allProducts.filter((p) => (p.stock_physical + p.stock_full) <= p.min_stock && p.min_stock > 0).length, [allProducts]);

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // row height
    overscan: 10,
  });

  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    scrollElement.addEventListener("scroll", handleScroll);
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openAdjustDialog = (p: typeof products[0]) => {
    setAdjustDialog({
      id: p.id,
      name: p.name,
      stock_physical: p.stock_physical,
      stock_full: p.stock_full,
      gtin_cx: p.gtin_cx,
      box_quantity: p.box_quantity,
    });
    setAdjustPhysical(String(p.stock_physical));
    setAdjustFull(String(p.stock_full));
    setAdjustBoxMode(false);
    setAdjustBoxGtinCx(p.gtin_cx || "");
    setAdjustBoxUnitsPerBox(p.box_quantity ? String(p.box_quantity) : "");
    setAdjustBoxCount("");
    setAdjustBoxTarget("physical");
  };


  const boxTotal = (parseInt(adjustBoxUnitsPerBox) || 0) * (parseInt(adjustBoxCount) || 0);

  const handleAdjustSave = async () => {
    if (!adjustDialog) return;

    if (adjustBoxMode && boxTotal > 0) {
      // Box mode: subtract units from selected stock
      const currentStock = adjustBoxTarget === "physical" ? adjustDialog.stock_physical : adjustDialog.stock_full;
      const newStock = Math.max(0, currentStock - boxTotal);
      const updateData = adjustBoxTarget === "physical"
        ? { stock_physical: newStock }
        : { stock_full: newStock };

      const { error } = await supabase.from("products").update(updateData).eq("id", adjustDialog.id).eq("company_id", companyId);
      if (error) {
        toast({ title: "Erro ao ajustar estoque", description: error.message, variant: "destructive" });
      } else {
        toast({ title: `Estoque ajustado! −${boxTotal} unidades (${adjustBoxCount} caixas × ${adjustBoxUnitsPerBox} un)` });
        refetch();
      }
    } else {
      // Individual mode
      const updateData: { stock_physical?: number; stock_full?: number } = {};
      if (adjustPhysical !== "") updateData.stock_physical = Number(adjustPhysical);
      if (adjustFull !== "") updateData.stock_full = Number(adjustFull);
      if (Object.keys(updateData).length === 0) return;

      const { error } = await supabase.from("products").update(updateData).eq("id", adjustDialog.id).eq("company_id", companyId);
      if (error) {
        toast({ title: "Erro ao ajustar estoque", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Estoque ajustado!" });
        refetch();
      }
    }

    setAdjustDialog(null);
    setAdjustPhysical("");
    setAdjustFull("");
    setAdjustBoxMode(false);
  };

  const handleExportCSV = () => {
    if (products.length === 0) {
      toast({ title: "Nenhum produto para exportar", variant: "destructive" });
      return;
    }
    const headers = ["SKU", "Produto", "Categoria", "Físico (un)", "FULL (un)", "Total (un)", "Mínimo", "Status"];
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

  const recentMovements: { date: string; product: string; type: "entrada" | "saida" | "ajuste"; qty: number; user: string }[] = [];

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
          { label: "Físico (un)", value: totalPhysical, icon: Warehouse, color: "text-primary" },
          { label: "FULL (un)", value: totalFull, icon: Package, color: "text-accent" },
          { label: "Total (un)", value: totalPhysical + totalFull, icon: ArrowRightLeft, color: "text-foreground" },
          { label: "Estoque Baixo", value: lowStock.length, icon: AlertTriangle, color: "text-destructive" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{formatNumber(stat.value)}</p>
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
                    <TableHead className="text-center">Físico (un)</TableHead>
                    <TableHead className="text-center">FULL (un)</TableHead>
                    <TableHead className="text-center">Total (un)</TableHead>
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
                    const hasBox = p.gtin_cx && p.box_quantity && p.box_quantity > 0;
                    const boxApprox = hasBox ? Math.floor(total / p.box_quantity!) : 0;
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
                        <TableCell className="text-center font-bold text-primary">{formatNumber(p.stock_physical)}</TableCell>
                        <TableCell className="text-center font-bold text-accent">{formatNumber(p.stock_full)}</TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold">{formatNumber(total)}</span>
                          {hasBox && total > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              ≈ {boxApprox} caixas de {p.box_quantity}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">{p.min_stock}</TableCell>
                        <TableCell>
                          {isZero ? (
                            <StatusBadge status="Zerado" />
                          ) : isLow ? (
                            <StatusBadge status="Baixo" />
                          ) : (
                            <StatusBadge status="Normal" />
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
                            onClick={() => openAdjustDialog(p)}
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
            <p className="text-sm font-medium text-foreground">Regra de Estoque</p>
            <p className="text-xs text-muted-foreground mt-1">
              Quantidades sempre em unidades individuais • Caixas são apenas forma de entrada/saída
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
            const divergentCount = allProds.filter((p) => {
              const isBelowMin = p.stock_physical < (p.min_stock || 0);
              const isZeroAndActive = p.stock_physical === 0 && p.active !== false;
              const isNegativeFull = p.stock_full < 0;
              return isBelowMin || isZeroAndActive || isNegativeFull;
            }).length;

            const validationFiltered = allProds
              .filter((p) => {
                const isBelowMin = p.stock_physical < (p.min_stock || 0);
                const isZeroAndActive = p.stock_physical === 0 && p.active !== false;
                const isNegativeFull = p.stock_full < 0;
                const isDivergent = isBelowMin || isZeroAndActive || isNegativeFull;
                
                if (onlyDivergent && !isDivergent) return false;
                
                if (validationSearch) {
                  const search = validationSearch.toLowerCase();
                  return p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search);
                }
                return true;
              });

            return (
              <>
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  <Card><CardContent className="flex items-center gap-3 p-4"><Warehouse className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Total Físico</p><p className="text-xl font-bold">{formatNumber(totalPhys)}</p></div></CardContent></Card>
                  <Card><CardContent className="flex items-center gap-3 p-4"><Package className="h-5 w-5 text-accent" /><div><p className="text-xs text-muted-foreground">Total FULL</p><p className="text-xl font-bold">{formatNumber(totalF)}</p></div></CardContent></Card>
                  <Card><CardContent className="flex items-center gap-3 p-4"><ArrowRightLeft className={`h-5 w-5 ${diff !== 0 ? "text-destructive" : "text-emerald-600"}`} /><div><p className="text-xs text-muted-foreground">Diferença</p><p className={`text-xl font-bold ${diff !== 0 ? "text-destructive" : "text-emerald-600"}`}>{formatDifference(diff)}</p></div></CardContent></Card>
                  <Card><CardContent className="flex items-center gap-3 p-4"><ShieldAlert className={`h-5 w-5 ${divergentCount > 0 ? "text-amber-600" : "text-emerald-600"}`} /><div><p className="text-xs text-muted-foreground">Com Divergência</p><p className="text-xl font-bold">{formatNumber(divergentCount)}</p></div></CardContent></Card>
                </div>

                <div className="flex flex-wrap items-center gap-3 py-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar nesta validação..."
                      className="pl-10 h-9"
                      value={validationSearch}
                      onChange={(e) => setValidationSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="divergent-only" checked={onlyDivergent} onCheckedChange={setOnlyDivergent} />
                    <Label htmlFor="divergent-only" className="text-xs">Apenas Divergentes</Label>
                  </div>
                </div>

                {validationFiltered.length > 0 ? (
                  <div className="rounded-md border border-muted-foreground/10 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="h-9">Produto</TableHead>
                          <TableHead className="h-9 text-center">Físico</TableHead>
                          <TableHead className="h-9 text-center">FULL</TableHead>
                          <TableHead className="h-9 text-center">Dif.</TableHead>
                          <TableHead className="h-9">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validationFiltered.map((p) => {
                          const d = p.stock_physical - p.stock_full;
                          const isBelowMin = p.stock_physical < (p.min_stock || 0);
                          const isZeroAndActive = p.stock_physical === 0 && p.active !== false;
                          const isNegativeFull = p.stock_full < 0;
                          const hasDivergence = isBelowMin || isZeroAndActive || isNegativeFull;

                          return (
                            <TableRow key={p.id}>
                              <TableCell className="py-2">
                                <p className="font-medium text-xs truncate max-w-[200px]">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                              </TableCell>
                              <TableCell className="text-center font-bold text-primary">{formatNumber(p.stock_physical)}</TableCell>
                              <TableCell className="text-center font-bold text-accent">{formatNumber(p.stock_full)}</TableCell>
                              <TableCell className="text-center font-bold">
                                <span className="text-muted-foreground">{formatDifference(d)}</span>
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
          {recentMovements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <History className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhuma movimentação registrada</p>
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>

      {/* Adjust dialog */}
      <Dialog open={!!adjustDialog} onOpenChange={(open) => !open && setAdjustDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste de Estoque{adjustDialog?.name ? ` — ${adjustDialog.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Mode toggle */}
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
              <div className="flex gap-1">
                <Button
                  variant={!adjustBoxMode ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setAdjustBoxMode(false)}
                >
                  ● Individual
                </Button>
                <Button
                  variant={adjustBoxMode ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setAdjustBoxMode(true)}
                >
                  <PackageOpen className="h-3.5 w-3.5 mr-1" />
                  Caixa fechada
                </Button>
              </div>
            </div>

            {!adjustBoxMode ? (
              <>
                <div>
                  <Label>Estoque Físico (un)</Label>
                  <Input type="number" min={0} value={adjustPhysical} onChange={(e) => setAdjustPhysical(e.target.value)} placeholder="Quantidade física" />
                </div>
                <div>
                  <Label>Estoque FULL (un)</Label>
                  <Input type="number" min={0} value={adjustFull} onChange={(e) => setAdjustFull(e.target.value)} placeholder="Quantidade FULL" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Retirar do estoque</Label>
                  <div className="flex gap-1 mt-1">
                    <Button
                      variant={adjustBoxTarget === "physical" ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-8 flex-1"
                      onClick={() => setAdjustBoxTarget("physical")}
                    >
                      Físico ({adjustDialog?.stock_physical || 0} un)
                    </Button>
                    <Button
                      variant={adjustBoxTarget === "full" ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-8 flex-1"
                      onClick={() => setAdjustBoxTarget("full")}
                    >
                      FULL ({adjustDialog?.stock_full || 0} un)
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">GTIN CX</Label>
                  <BarcodeScannerInput
                    value={adjustBoxGtinCx}
                    onChange={setAdjustBoxGtinCx}
                    placeholder="Código da caixa"
                    showCameraButton
                    inputClassName="h-9 text-sm"
                  />
                  {adjustDialog?.gtin_cx && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Cadastrado: {adjustDialog.gtin_cx}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Unidades por caixa</Label>
                  <Input
                    type="number"
                    min={1}
                    value={adjustBoxUnitsPerBox}
                    onChange={(e) => setAdjustBoxUnitsPerBox(e.target.value)}
                    placeholder="Ex: 12"
                    className="h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Editável — varia por saída</p>
                </div>
                <div>
                  <Label className="text-xs">Qtd de caixas a retirar</Label>
                  <Input
                    type="number"
                    min={1}
                    value={adjustBoxCount}
                    onChange={(e) => setAdjustBoxCount(e.target.value)}
                    placeholder="Ex: 2"
                    className="h-9 text-sm"
                  />
                </div>
                {boxTotal > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-sm font-semibold text-center">
                      {adjustBoxCount} caixas × {adjustBoxUnitsPerBox} un = <span className="text-primary">{boxTotal} unidades</span>
                    </p>
                    <p className="text-[10px] text-center text-muted-foreground mt-1">
                      Saldo após ajuste: {Math.max(0, (adjustBoxTarget === "physical" ? (adjustDialog?.stock_physical || 0) : (adjustDialog?.stock_full || 0)) - boxTotal)} un
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)}>Cancelar</Button>
            <Button onClick={handleAdjustSave} disabled={!adjustDialog?.id || (adjustBoxMode && boxTotal <= 0)}>
              {adjustBoxMode ? `Retirar ${boxTotal} un` : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Estoque;
