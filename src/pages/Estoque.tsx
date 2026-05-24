import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useNavigate } from "react-router-dom";
import {
  Warehouse, Package, ArrowRightLeft, AlertTriangle, Search, Loader2,
  ShieldCheck, ShieldAlert, Pencil, Plus, Download, ClipboardEdit,
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
    estimateSize: () => 64,
    overscan: 10,
  });

  const boxTotal = (parseInt(adjustBoxUnitsPerBox) || 0) * (parseInt(adjustBoxCount) || 0);

  const handleAdjustSave = async () => {
    if (!adjustDialog) return;
    if (adjustBoxMode && boxTotal > 0) {
      const currentStock = adjustBoxTarget === "physical" ? adjustDialog.stock_physical : adjustDialog.stock_full;
      const newStock = Math.max(0, currentStock - boxTotal);
      const updateData = adjustBoxTarget === "physical" ? { stock_physical: newStock } : { stock_full: newStock };
      const { error } = await supabase.from("products").update(updateData).eq("id", adjustDialog.id).eq("company_id", companyId);
      if (error) toast({ title: "Erro ao ajustar estoque", description: error.message, variant: "destructive" });
      else { toast({ title: `Estoque ajustado! −${boxTotal} un` }); refetch(); }
    } else {
      const updateData: { stock_physical?: number; stock_full?: number } = {};
      if (adjustPhysical !== "") updateData.stock_physical = Number(adjustPhysical);
      if (adjustFull !== "") updateData.stock_full = Number(adjustFull);
      const { error } = await supabase.from("products").update(updateData).eq("id", adjustDialog.id).eq("company_id", companyId);
      if (error) toast({ title: "Erro ao ajustar estoque", description: error.message, variant: "destructive" });
      else { toast({ title: "Estoque ajustado!" }); refetch(); }
    }
    setAdjustDialog(null); setAdjustBoxMode(false);
  };

  const handleExportCSV = () => {
    if (allProducts.length === 0) return;
    const headers = ["SKU", "Produto", "Categoria", "Físico", "FULL", "Total"];
    const rows = allProducts.map((p) => [p.sku, p.name, p.categories?.name || "", p.stock_physical, p.stock_full, p.stock_physical + p.stock_full]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "estoque.csv"; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Controle de Estoque</h1>
          <p className="text-muted-foreground">Estoque Físico + FULL (Mercado Livre)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 mr-1" /> Exportar</Button>
          <Button size="sm" onClick={() => navigate("/entrada-nota")}><Plus className="h-4 w-4 mr-1" /> Nova Entrada</Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Físico</p><p className="text-2xl font-bold">{formatNumber(totalPhysical)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">FULL</p><p className="text-2xl font-bold">{formatNumber(totalFull)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{formatNumber(totalPhysical + totalFull)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Abaixo Mín.</p><p className="text-2xl font-bold text-destructive">{lowStockCount}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar produto..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="low">Baixo Estoque</SelectItem>
                <SelectItem value="zero">Sem Estoque</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div ref={parentRef} className="h-[500px] overflow-auto rounded-md border">
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const p = filtered[virtualRow.index];
                return (
                  <div
                    key={p.id}
                    className="absolute top-0 left-0 w-full border-b flex items-center px-4 hover:bg-muted/50"
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                    </div>
                    <div className="w-24 text-center font-bold text-primary">{formatNumber(p.stock_physical)}</div>
                    <div className="w-24 text-center font-bold text-accent">{formatNumber(p.stock_full)}</div>
                    <div className="w-24 text-center font-bold">{formatNumber(p.stock_physical + p.stock_full)}</div>
                  </div>
                );
              })}
            </div>
            {hasNextPage && (
              <div className="p-4 text-center">
                <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : "Carregar mais"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!adjustDialog} onOpenChange={(open) => !open && setAdjustDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajuste: {adjustDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input type="number" placeholder="Físico" value={adjustPhysical} onChange={(e) => setAdjustPhysical(e.target.value)} />
            <Input type="number" placeholder="FULL" value={adjustFull} onChange={(e) => setAdjustFull(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)}>Cancelar</Button>
            <Button onClick={handleAdjustSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Estoque;
