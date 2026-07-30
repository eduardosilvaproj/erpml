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
    estimateSize: () => 64,
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
    const headers = ["SKU", "Produto", "Marca", "Tipo", "Físico", "FULL", "Total", "Preço Custo", "Preço Venda", "Valor Total"].join(sep);
    const rows = filteredItems.map((p) => [
      quote(p.sku),
      quote(p.name),
      quote(p.brand),
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Controle de Estoque</h1>
          <p className="text-muted-foreground">Estoque Físico + FULL (Mercado Livre)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 mr-1" /> Exportar</Button>
          {kits && kits.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
              onClick={handleReprocessKitStock}
              disabled={reprocessingKits}
            >
              {reprocessingKits ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Reprocessar Kits
            </Button>
          )}
          <Button size="sm" onClick={() => navigate("/entrada-nota")}><Plus className="h-4 w-4 mr-1" /> Nova Entrada</Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Físico</p><p className="text-2xl font-bold">{formatNumber(totalPhysical)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">FULL</p><p className="text-2xl font-bold">{formatNumber(totalFull)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{formatNumber(totalPhysical + totalFull)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Abaixo Mín.</p><p className="text-2xl font-bold text-destructive">{lowStockCount}</p></CardContent></Card>
        <Card className="border-purple-200 bg-purple-50/30"><CardContent className="p-4"><p className="text-sm text-purple-600">Kits</p><p className="text-2xl font-bold text-purple-700">{kits?.length || 0}</p><p className="text-xs text-purple-500">{kits?.filter(k => (k.stock_physical || 0) > 0).length || 0} com estoque</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar produto..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Input placeholder="Filtrar por marca..." className="w-[180px]" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} />
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="with_stock">Com Estoque</SelectItem>
                <SelectItem value="low">Baixo Estoque</SelectItem>
                <SelectItem value="zero">Sem Estoque</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "name_asc" | "stock_asc" | "stock_desc")}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Nome A-Z</SelectItem>
                <SelectItem value="stock_asc">Estoque Crescente</SelectItem>
                <SelectItem value="stock_desc">Estoque Decrescente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div ref={parentRef} className="h-[500px] overflow-auto rounded-md border">
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = filteredItems[virtualRow.index];
                return (
                  <div
                    key={item.id}
                    className={`absolute top-0 left-0 w-full border-b flex items-center px-4 hover:bg-muted/50 ${item.type === 'kit' ? 'bg-purple-50/30' : ''}`}
                    style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {item.type === 'kit' && <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700">KIT</Badge>}
                        <p className="font-medium text-sm truncate">{item.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                    </div>
                    <div className="w-24 text-center font-bold text-primary">{formatNumber(item.stock_physical)}</div>
                    <div className="w-24 text-center font-bold text-accent">{formatNumber(item.stock_full)}</div>
                    <div className="w-24 text-center font-bold">{formatNumber(item.stock_physical + item.stock_full)}</div>
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
