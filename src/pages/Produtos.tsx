import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useNavigate, useLocation } from "react-router-dom";
import { Package, Plus, Search, Pencil, Trash2, Loader2, Wand2, Upload, Download, Settings2, AlertTriangle, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useProductsInfinite, useCategories, useSuppliers, useDeleteProduct, type Product } from "@/hooks/useProductData";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { useBarcodeSearch } from "@/hooks/useBarcodeSearch";
import { BarcodeSearchDialogs } from "@/components/barcode/BarcodeSearchDialogs";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { SupplierFormDialog } from "@/components/SupplierFormDialog";
import { enrichProduct } from "@/lib/enrich-product";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const Produtos = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const barcodeSearch = useBarcodeSearch();
  const [barcodeInput, setBarcodeInput] = useState("");
  
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [correctionFilter, setCorrectionFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0, name: "" });

  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const deleteProduct = useDeleteProduct();

  const filters = useMemo(() => ({
    search: search || undefined,
    category_id: categoryFilter || undefined,
    brand: brandFilter || undefined,
    supplier_id: supplierFilter || undefined,
    status: (statusFilter as any) || "active",
    needsCorrection: (correctionFilter as any) || undefined,
    sortBy,
    sortOrder,
  }), [search, categoryFilter, brandFilter, supplierFilter, statusFilter, correctionFilter, sortBy, sortOrder]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useProductsInfinite(filters);

  const { targetRef, isIntersecting } = useIntersectionObserver();

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allProducts = data?.pages.flatMap(page => page.products) || [];

  const handleBatchEnrich = useCallback(async () => {
    setEnriching(true);
    try {
      const { data: allProductsData, error } = await supabase
        .from("products")
        .select("id, name, barcode, description, weight, width, height, depth, price")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const incomplete = (allProductsData || []).filter(
        (p) => !p.description || p.description.length < 10 || p.weight == null || p.width == null || p.height == null || p.depth == null
      );

      if (incomplete.length === 0) {
        toast({ title: "Todos os produtos já possuem dados completos!" });
        setEnriching(false);
        return;
      }

      setEnrichProgress({ current: 0, total: incomplete.length, name: "" });
      let successCount = 0;

      for (let i = 0; i < incomplete.length; i++) {
        const prod = incomplete[i];
        setEnrichProgress({ current: i + 1, total: incomplete.length, name: prod.name });
        try {
          const enriched = await enrichProduct({ productName: prod.name, ean: prod.barcode || undefined });
          const updates: Record<string, any> = {};
          if (enriched.description && (!prod.description || prod.description.length < 10)) updates.description = enriched.description;
          if (enriched.weight_kg != null && prod.weight == null) updates.weight = enriched.weight_kg;
          if (enriched.width_cm != null && prod.width == null) updates.width = enriched.width_cm;
          if (enriched.height_cm != null && prod.height == null) updates.height = enriched.height_cm;
          if (enriched.depth_cm != null && prod.depth == null) updates.depth = enriched.depth_cm;
          if (enriched.suggested_price_brl != null && prod.price === 0) updates.price = enriched.suggested_price_brl;
          if (Object.keys(updates).length > 0) {
            await supabase.from("products").update(updates as any).eq("id", prod.id).eq("company_id", companyId);
            successCount++;
          }
        } catch { /* skip */ }
        if (i < incomplete.length - 1) await new Promise((r) => setTimeout(r, 500));
      }

      queryClient.invalidateQueries({ queryKey: ["products-infinite"] });
      toast({ title: "Atualização com IA concluída!", description: `${successCount} de ${incomplete.length} produto(s) atualizado(s).` });
    } catch (err: any) {
      toast({ title: "Erro na atualização", description: err.message, variant: "destructive" });
    } finally {
      setEnriching(false);
      setEnrichProgress({ current: 0, total: 0, name: "" });
    }
  }, [toast, queryClient, companyId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === allProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allProducts.map((p) => p.id)));
    }
  };

  const handleExport = () => {
    const headers = ["SKU", "Nome", "Preço", "Estoque", "Status"];
    const rows = allProducts.map((p) => [p.sku, p.name, p.price, p.stock_physical, p.active ? "Ativo" : "Inativo"]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "produtos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEdit = (product: Product) => { setEditingProduct(product); setProductDialogOpen(true); };

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <Tabs defaultValue="products">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-semibold leading-tight">Produtos</h1>
            <p className="text-xs text-muted-foreground">Catálogo e fornecedores</p>
          </div>
          <div className="flex items-center gap-2">
            <TabsList className="h-8">
              <TabsTrigger value="products" className="text-xs">Produtos</TabsTrigger>
              <TabsTrigger value="suppliers" className="text-xs">Fornecedores</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="products" className="space-y-3 mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="h-8" onClick={() => navigate("/importacao")}>
                <Upload className="mr-2 h-4 w-4" /> Importar
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
              {/* Wand2 no lugar de Sparkles: mesma decisão do botão de
                  sugestão em Ordens Full — brilho é a assinatura visual de
                  feature de IA e o cliente desconta valor ao reconhecer. */}
              <Button variant="outline" size="sm" className="h-8" onClick={handleBatchEnrich} disabled={enriching}>
                {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {enriching ? "Completando…" : "Completar dados"}
              </Button>
            </div>
            <Button size="sm" className="h-8" onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Novo produto
            </Button>
          </div>

          {enriching && enrichProgress.total > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Enriquecendo: {enrichProgress.name}</span>
                <span>{enrichProgress.current}/{enrichProgress.total}</span>
              </div>
              <Progress value={(enrichProgress.current / enrichProgress.total) * 100} />
            </div>
          )}

          <Card className="op-card">
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou código…"
                    className="h-9 pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-9 w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por marca…"
                    className="h-9 w-[170px] pl-8"
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={selectedIds.size === allProducts.length && allProducts.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                  <TableHead className="w-32">SKU</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-24 text-right">Preço</TableHead>
                  <TableHead className="w-20 text-right">Estoque</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  allProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell><Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} /></TableCell>
                      <TableCell className="code text-[11px] text-muted-foreground">{p.sku}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="qty text-right">R$ {p.price.toFixed(2)}</TableCell>
                      <TableCell className="qty text-right">{p.stock_physical}</TableCell>
                      <TableCell>
                        {/* Badge de borda, não preenchido: em tabela densa o
                            fundo saturado atrapalha a varredura vertical. */}
                        <span
                          className="rounded-sm border px-1.5 py-0 text-[11px] font-medium uppercase tracking-wide"
                          style={p.active
                            ? { color: "hsl(var(--success))", borderColor: "hsl(var(--success) / 0.4)", background: "hsl(var(--success) / 0.08)" }
                            : { color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}
                        >
                          {p.active ? "Ativo" : "Inativo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteProduct.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div ref={targetRef} className="border-t border-border py-3 text-center text-xs text-muted-foreground">
              {isFetchingNextPage ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Carregando mais produtos…
                </div>
              ) : hasNextPage ? (
                "Role para carregar mais"
              ) : (
                `${allProducts.length} produto(s)`
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="suppliers">
          {/* Fornecedores logic here - typically less items so pagination might be simpler or infinite too */}
          <div className="p-8 text-center text-muted-foreground">
            Aba de Fornecedores - use o componente SupplierFormDialog e listagem similar.
          </div>
        </TabsContent>
      </Tabs>

      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editingProduct}
      />

      <SupplierFormDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
      />

      <BarcodeSearchDialogs
        notFoundOpen={barcodeSearch.notFoundOpen}
        setNotFoundOpen={barcodeSearch.setNotFoundOpen}
        boxDetectedOpen={barcodeSearch.boxDetectedOpen}
        setBoxDetectedOpen={barcodeSearch.setBoxDetectedOpen}
        codigo={barcodeSearch.lastCodigo}
        produto={barcodeSearch.lastResult?.produto}
        boxQty={barcodeSearch.lastResult?.qty}
        onConfirmBox={(qty) => {
          setSearch(barcodeSearch.lastCodigo);
        }}
        onRegisterGtin={() => {
          setEditingProduct({ gtin_cx: barcodeSearch.lastCodigo } as any);
          setProductDialogOpen(true);
        }}
        onRegisterProduct={() => {
          setEditingProduct({ barcode: barcodeSearch.lastCodigo } as any);
          setProductDialogOpen(true);
        }}
        onLinkProduct={() => {
          toast({ title: "Funcionalidade em desenvolvimento" });
        }}
      />
    </div>
  );
};

export default Produtos;
