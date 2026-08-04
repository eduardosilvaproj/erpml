import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useNavigate } from "react-router-dom";
import {
  Warehouse, Package, ArrowRightLeft, AlertTriangle, Search, Loader2,
  ShieldCheck, ShieldAlert, Pencil, Plus, Download, ClipboardEdit,
  ArrowUpRight, ArrowDownLeft, RotateCcw, History, PackageOpen, RefreshCw
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
import { useAllKits } from "@/hooks/useKitData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { stockService } from "@/services/stock";
import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { StatusBadge } from "@/components/StatusBadge";
import { formatNumber, formatDifference } from "@/lib/formatters";
import { useVirtualizer } from "@tanstack/react-virtual";

const Estoque = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"name_asc" | "stock_asc" | "stock_desc">("name_asc");
  const [onlyDivergent, setOnlyDivergent] = useState(false);
  const [reprocessingKits, setReprocessingKits] = useState(false);
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
    brand: brandFilter || undefined,
    sortBy: "name",
    sortOrder: "asc" as const,
  }), [search, categoryFilter, brandFilter]);

  const { data, isLoading, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useProductsInfinite(filters);
  const { data: categories } = useCategories();
  const { data: kits } = useAllKits();

  const allProducts = useMemo(() => data?.pages.flatMap(page => page.products) || [], [data]);

  // Combinar produtos e kits para busca
  const allItems = useMemo(() => {
    const productItems = allProducts.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      ean: p.ean,
      cost: p.cost || 0,
      price: p.price || 0,
      stock_physical: p.stock_physical,
      stock_full: p.stock_full,
      min_stock: p.min_stock,
      type: 'product' as const,
    }));

    const kitItems = (kits || []).map(k => ({
      id: k.id,
      name: k.name,
      sku: k.sku,
      ean: k.ean || '',
      brand: '',
      cost: 0,
      price: 0,
      stock_physical: k.stock_physical || 0,
      stock_full: k.stock_full || 0,
      min_stock: k.stock_min || 0,
      type: 'kit' as const,
    }));

    return [...productItems, ...kitItems];
  }, [allProducts, kits]);

  // Filtrar por busca
  const filteredItems = useMemo(() => {
    let result = allItems;
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.sku.toLowerCase().includes(searchLower) ||
        (item.ean && item.ean.toLowerCase().includes(searchLower))
      );
    }
    if (stockFilter === "low") {
      result = result.filter((p) => (p.stock_physical + p.stock_full) <= p.min_stock && p.min_stock > 0);
    } else if (stockFilter === "zero") {
      result = result.filter((p) => p.stock_physical + p.stock_full === 0);
    } else if (stockFilter === "with_stock") {
      result = result.filter((p) => p.stock_physical + p.stock_full > 0);
    }

    // Ordenação
    result = [...result].sort((a, b) => {
      const totalA = a.stock_physical + a.stock_full;
      const totalB = b.stock_physical + b.stock_full;
      if (sortOrder === "stock_asc") return totalA - totalB;
      if (sortOrder === "stock_desc") return totalB - totalA;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    return result;
  }, [allItems, search, stockFilter, sortOrder]);

  const totalPhysical = useMemo(() => allItems.filter(i => i.type === 'product').reduce((s, p) => s + p.stock_physical, 0), [allItems]);
  const totalFull = useMemo(() => allItems.filter(i => i.type === 'product').reduce((s, p) => s + p.stock_full, 0), [allItems]);
  const lowStockCount = useMemo(() => allItems.filter((p) => (p.stock_physical + p.stock_full) <= p.min_stock && p.min_stock > 0 && p.type === 'product').length, [allItems]);

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => parentRef.current,
    // Deve acompanhar a altura real da linha na lista abaixo. O virtualizer
    // posiciona por absolute usando este valor: divergir gera buraco ou
    // sobreposição entre linhas.
    estimateSize: () => 44,
    overscan: 10,
  });

  const boxTotal = (parseInt(adjustBoxUnitsPerBox) || 0) * (parseInt(adjustBoxCount) || 0);

  const handleAdjustSave = async () => {
    if (!adjustDialog) return;
    try {
      if (adjustBoxMode && boxTotal > 0) {
        const currentStock = adjustBoxTarget === "physical" ? adjustDialog.stock_physical : adjustDialog.stock_full;
        const newStock = Math.max(0, currentStock - boxTotal);
        const updateData = adjustBoxTarget === "physical" ? { stock_physical: newStock } : { stock_full: newStock };
        const { error } = await supabase.from("products").update(updateData).eq("id", adjustDialog.id).eq("company_id", companyId);
        if (error) throw error;

        // Registrar no histórico
        await stockService.logMovement({
          productId: adjustDialog.id,
          companyId,
          type: 'ajuste',
          quantity: -(boxTotal),
          oldStock: currentStock,
          newStock,
          stockType: adjustBoxTarget,
          referenceType: 'manual',
          notes: `Ajuste por caixa: −${boxTotal} un (${adjustBoxCount} cx × ${adjustBoxUnitsPerBox} un)`
        });

        toast({ title: `Estoque ajustado! −${boxTotal} un` });
        refetch();
      } else {
        const updateData: { stock_physical?: number; stock_full?: number } = {};
        if (adjustPhysical !== "") updateData.stock_physical = Number(adjustPhysical);
        if (adjustFull !== "") updateData.stock_full = Number(adjustFull);

        // Buscar valores atuais antes de atualizar
        const { data: currentProduct } = await supabase
          .from("products")
          .select("stock_physical, stock_full")
          .eq("id", adjustDialog.id)
          .eq("company_id", companyId)
          .maybeSingle();

        const { error } = await supabase.from("products").update(updateData).eq("id", adjustDialog.id).eq("company_id", companyId);
        if (error) throw error;

        // Registrar no histórico para cada campo alterado
        if (adjustPhysical !== "" && currentProduct) {
          const oldPhysical = currentProduct.stock_physical || 0;
          const newPhysical = Number(adjustPhysical);
          await stockService.logMovement({
            productId: adjustDialog.id,
            companyId,
            type: 'ajuste',
            quantity: newPhysical - oldPhysical,
            oldStock: oldPhysical,
            newStock: newPhysical,
            stockType: 'physical',
            referenceType: 'manual',
            notes: 'Ajuste manual de estoque físico'
          });
        }
        if (adjustFull !== "" && currentProduct) {
          const oldFull = currentProduct.stock_full || 0;
          const newFull = Number(adjustFull);
          await stockService.logMovement({
            productId: adjustDialog.id,
            companyId,
            type: 'ajuste',
            quantity: newFull - oldFull,
            oldStock: oldFull,
            newStock: newFull,
            stockType: 'full',
            referenceType: 'manual',
            notes: 'Ajuste manual de estoque FULL'
          });
        }

        toast({ title: "Estoque ajustado!" });
        refetch();
      }
    } catch (err: any) {
      toast({ title: "Erro ao ajustar estoque", description: err.message, variant: "destructive" });
    }
    setAdjustDialog(null); setAdjustBoxMode(false);
  };

  const handleExportCSV = () => {
    if (filteredItems.length === 0) return;
    const BOM = "﻿";
    const sep = ";";
    const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const headers = ["SKU", "Produto", "Tipo", "Físico", "FULL", "Total", "Preço Custo", "Preço Venda", "Valor Total"].join(sep);
    const rows = filteredItems.map((p) => [
      quote(p.sku),
      quote(p.name),
      quote(p.type === 'kit' ? 'Kit' : 'Produto'),
      p.stock_physical,
      p.stock_full,
      p.stock_physical + p.stock_full,
      p.cost,
      p.price,
      (p.stock_physical + p.stock_full) * p.price
    ].join(sep));
    const csv = BOM + [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a"); a.href = url; a.download = `estoque-${date}.csv`; a.click();
  };

  const handleReprocessKitStock = async () => {
    if (!companyId || !kits || kits.length === 0) return;
    setReprocessingKits(true);
    try {
      const updates: { id: string; stock: number }[] = [];

      // Calcular estoque de cada kit
      for (const kit of kits) {
        if (!kit.kit_items || kit.kit_items.length === 0) {
          updates.push({ id: kit.id, stock: 0 });
          continue;
        }
        let minStock = 999999;
        for (const item of kit.kit_items) {
          const product = (item as any).products;
          if (!product || product.stock_physical <= 0) {
            minStock = 0;
            break;
          }
          const possible = Math.floor(product.stock_physical / item.quantity);
          if (possible < minStock) minStock = possible;
        }
        updates.push({ id: kit.id, stock: minStock === 999999 ? 0 : minStock });
      }

      // Atualizar em batch (mais eficiente para muitos kits)
      const kitIds = updates.map(u => u.id);
      const stockValues = updates.map(u => u.stock);

      // Atualizar cada um (Supabase não suporta batch update, mas podemos usar RPC)
      for (let i = 0; i < updates.length; i++) {
        await supabase
          .from("product_kits")
          .update({ stock_physical: updates[i].stock })
          .eq("id", updates[i].id)
          .eq("company_id", companyId);
      }

      toast({ title: "Estoque de kits reprocessado!", description: `${updates.length} kits atualizados.` });
      window.location.reload();
    } catch (err: any) {
      toast({ title: "Erro ao reprocessar", description: err.message, variant: "destructive" });
    } finally {
      setReprocessingKits(false);
    }
  };

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold leading-tight">Controle de estoque</h1>
          <p className="text-xs text-muted-foreground">Físico + Full (Mercado Livre)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={handleExportCSV}><Download className="h-4 w-4 mr-1" /> Exportar</Button>
          {kits && kits.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={handleReprocessKitStock}
              disabled={reprocessingKits}
            >
              {reprocessingKits ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Reprocessar Kits
            </Button>
          )}
          <Button size="sm" className="h-8" onClick={() => navigate("/entrada-nota")}><Plus className="h-4 w-4 mr-1" /> Nova entrada</Button>
        </div>
      </div>

      {/* Indicadores em faixa: rótulo pequeno acima, número tabular abaixo.
          Sem card por métrica — 5 caixas com sombra viravam parede de blocos. */}
      <div className="grid grid-cols-2 divide-x divide-border border border-border bg-card md:grid-cols-5">
        {[
          { label: "Físico", value: formatNumber(totalPhysical) },
          { label: "Full", value: formatNumber(totalFull) },
          { label: "Total", value: formatNumber(totalPhysical + totalFull) },
          { label: "Abaixo do mínimo", value: String(lowStockCount), danger: lowStockCount > 0 },
          { label: "Kits", value: String(kits?.length || 0), hint: `${kits?.filter(k => (k.stock_physical || 0) > 0).length || 0} com estoque` },
        ].map((kpi) => (
          <div key={kpi.label} className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
            <p
              className="qty text-xl leading-tight"
              style={kpi.danger ? { color: "hsl(var(--destructive))" } : undefined}
            >
              {kpi.value}
            </p>
            {kpi.hint && <p className="text-[10px] text-muted-foreground">{kpi.hint}</p>}
          </div>
        ))}
      </div>

      <Card className="op-card">
        <CardHeader className="p-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar produto…" className="h-9 pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Input placeholder="Filtrar por marca…" className="h-9 w-[170px]" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} />
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="with_stock">Com estoque</SelectItem>
                <SelectItem value="low">Estoque baixo</SelectItem>
                <SelectItem value="zero">Sem estoque</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "name_asc" | "stock_asc" | "stock_desc")}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Nome A-Z</SelectItem>
                <SelectItem value="stock_asc">Estoque crescente</SelectItem>
                <SelectItem value="stock_desc">Estoque decrescente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {/* Cabeçalho fixo: a lista é virtualizada, então não é <table> —
              as larguras aqui precisam bater com as das linhas abaixo. */}
          <div className="flex items-center border border-border border-b-0 bg-muted px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="flex-1">Produto</div>
            <div className="w-20 text-right">Físico</div>
            <div className="w-20 text-right">Full</div>
            <div className="w-20 text-right">Total</div>
          </div>
          <div ref={parentRef} className="h-[560px] overflow-auto border border-border">
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = filteredItems[virtualRow.index];
                return (
                  <div
                    key={item.id}
                    className="absolute top-0 left-0 flex w-full items-center border-b border-border px-3 text-[13px] hover:bg-muted"
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {item.type === 'kit' && (
                          <span className="rounded-sm border border-border px-1 text-[9px] font-semibold uppercase text-muted-foreground">Kit</span>
                        )}
                        <p className="truncate font-medium leading-tight">{item.name}</p>
                      </div>
                      <p className="code text-[11px] text-muted-foreground">{item.sku}</p>
                    </div>
                    <div className="qty w-20 text-right">{formatNumber(item.stock_physical)}</div>
                    <div className="qty w-20 text-right text-muted-foreground">{formatNumber(item.stock_full)}</div>
                    <div className="qty w-20 text-right">{formatNumber(item.stock_physical + item.stock_full)}</div>
                  </div>
                );
              })}
            </div>
            {isFetchingNextPage && (
              <div className="p-4 text-center">
                <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                  <Loader2 className="h-4 w-4 animate-spin" />
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
