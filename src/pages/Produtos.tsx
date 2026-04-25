import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Package, Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight, Loader2, Truck, Sparkles, Upload, Download, Settings2, AlertTriangle, Barcode, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useProducts, useCategories, useSuppliers, useDeleteProduct, useDeleteSupplier, type Product } from "@/hooks/useProductData";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { SupplierFormDialog } from "@/components/SupplierFormDialog";
import { enrichProduct } from "@/lib/enrich-product";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const Produtos = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const correction = params.get("correction");
    if (correction) {
      setCorrectionFilter(correction);
    }
  }, [location.search]);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [correctionFilter, setCorrectionFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0, name: "" });
  const [inlineEans, setInlineEans] = useState<Record<string, string>>({});

  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data, isLoading } = useProducts({
    search: search || undefined,
    category_id: categoryFilter || undefined,
    supplier_id: supplierFilter || undefined,
    needsCorrection: (correctionFilter as any) || undefined,
    page,
    pageSize,
    sortBy,
    sortOrder,
  });
  const deleteProduct = useDeleteProduct();
  const deleteSupplier = useDeleteSupplier();

  // Filter by status client-side
  const filteredProducts = (data?.products || []).filter((p) => {
    if (statusFilter === "active") return p.active;
    if (statusFilter === "inactive") return !p.active;
    return true;
  });

  const handleBatchEnrich = useCallback(async () => {
    setEnriching(true);
    try {
      const { data: allProducts, error } = await supabase
        .from("products")
        .select("id, name, barcode, description, weight, width, height, depth, price")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const incomplete = (allProducts || []).filter(
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
            await supabase.from("products").update(updates as any).eq("id", prod.id);
            successCount++;
          }
        } catch { /* skip */ }
        if (i < incomplete.length - 1) await new Promise((r) => setTimeout(r, 500));
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Atualização com IA concluída!", description: `${successCount} de ${incomplete.length} produto(s) atualizado(s).` });
    } catch (err: any) {
      toast({ title: "Erro na atualização", description: err.message, variant: "destructive" });
    } finally {
      setEnriching(false);
      setEnrichProgress({ current: 0, total: 0, name: "" });
    }
  }, [toast, queryClient]);

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortOrder("asc"); }
    setPage(1);
  };

  const openEdit = (product: Product) => { setEditingProduct(product); setProductDialogOpen(true); };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await deleteProduct.mutateAsync(id);
    }
    setSelectedIds(new Set());
  };

  const handleExport = () => {
    if (!data?.products?.length) return;
    const headers = ["SKU", "Nome", "Categoria", "Custo", "Preço", "Estoque Físico", "Estoque FULL", "Status"];
    const rows = data.products.map((p) => [
      p.sku, p.name, p.categories?.name || "", p.cost, p.price, p.stock_physical, p.stock_full, p.active ? "Ativo" : "Inativo",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "produtos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortIndicator = (col: string) => sortBy === col ? (sortOrder === "asc" ? " ↑" : " ↓") : "";

  const handleInlineEan = async (productId: string, ean: string) => {
    if (!ean) return;
    try {
      const { error } = await supabase
        .from("products")
        .update({ barcode: ean, ean: ean, ean_pending: false } as any)
        .eq("id", productId);

      if (error) throw error;
      
      toast({ title: "EAN vinculado com sucesso!" });
      setInlineEans(prev => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast({ title: "Erro ao vincular EAN", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="products">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
            <p className="text-muted-foreground text-sm">Gerencie seu catálogo</p>
          </div>
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* ===== PRODUCTS TAB ===== */}
        <TabsContent value="products" className="space-y-4 mt-4">
          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Importar
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/produtos/correcao")}>
                <Settings2 className="mr-2 h-4 w-4" /> Corrigir SKUs
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
              <Button variant="outline" size="sm" onClick={handleBatchEnrich} disabled={enriching}>
                {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {enriching ? "Atualizando..." : "Atualizar com IA"}
              </Button>
            </div>
            <Button onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Novo Produto
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

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou código..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
                <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter || "all"} onValueChange={(v) => { setCategoryFilter(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={correctionFilter || "all"} onValueChange={(v) => { setCorrectionFilter(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Necessita correção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sem filtros de corr.</SelectItem>
                    <SelectItem value="no_sku">Sem SKU Interno</SelectItem>
                    <SelectItem value="no_supplier">Sem Fornecedor</SelectItem>
                    <SelectItem value="no_ean">Sem EAN</SelectItem>
                  </SelectContent>
                </Select>

                {/* No EAN Alert */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 hover:text-amber-800 border border-amber-200/50"
                  onClick={() => { setCorrectionFilter("no_ean"); setPage(1); }}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  {data?.products?.filter(p => (p as any).ean_pending).length || 0} produtos sem EAN
                </Button>

                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {data?.total ?? 0} produtos encontrados
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <span className="text-sm text-destructive font-medium">{selectedIds.size} selecionado(s)</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir selecionados
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {selectedIds.size} produto(s)?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProducts.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="w-[50px]">Foto</TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("sku")}>
                            EAN / SKU{sortIndicator("sku")}
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                            Nome{sortIndicator("name")}
                          </TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="cursor-pointer text-right" onClick={() => handleSort("price")}>
                            Preço{sortIndicator("price")}
                          </TableHead>
                          <TableHead className="cursor-pointer text-center" onClick={() => handleSort("stock_physical")}>
                            Estoque{sortIndicator("stock_physical")}
                          </TableHead>
                          {correctionFilter === "no_ean" && (
                            <TableHead className="w-[200px]">EAN (Bipar)</TableHead>
                          )}
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="w-[90px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.map((product, idx) => {
                          const totalStock = product.stock_physical + product.stock_full;
                          return (
                            <TableRow
                              key={product.id}
                              className={idx % 2 === 0 ? "bg-transparent" : "bg-muted/5"}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(product.id)}
                                  onCheckedChange={() => toggleSelect(product.id)}
                                />
                              </TableCell>
                              <TableCell>
                                {product.image_url ? (
                                  <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded-lg object-cover" />
                                ) : (
                                  <div className="h-10 w-10 rounded-lg bg-muted/30 flex items-center justify-center">
                                    <Package className="h-5 w-5 text-muted-foreground/40" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <span className="font-mono text-xs font-bold text-foreground">
                                    {product.ean || product.sku}
                                  </span>
                                  {product.product_supplier_skus && product.product_supplier_skus.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={product.product_supplier_skus.map(s => `${s.supplier_name}: ${s.supplier_sku}`).join("\n")}>
                                      Fornecedores: {product.product_supplier_skus.map(s => s.supplier_name).join(" · ")}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                              <TableCell>
                                {product.categories?.name && (
                                  <Badge variant="secondary" className="text-xs">{product.categories.name}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(product.price)}</TableCell>
                              <TableCell className="text-center">
                                <span className={totalStock <= 0 ? "text-destructive font-semibold" : "text-foreground"}>
                                  {totalStock}
                                </span>
                              </TableCell>
                              {correctionFilter === "no_ean" && (
                                <TableCell>
                                  <div className="relative">
                                    <Barcode className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground opacity-50" />
                                    <Input
                                      size={1}
                                      className="h-8 pl-7 text-xs"
                                      placeholder="bipe aqui 📷"
                                      value={inlineEans[product.id] || ""}
                                      onChange={(e) => setInlineEans(prev => ({ ...prev, [product.id]: e.target.value }))}
                                      onKeyDown={(e) => e.key === "Enter" && handleInlineEan(product.id, inlineEans[product.id])}
                                    />
                                  </div>
                                </TableCell>
                              )}
                              <TableCell className="text-center">
                                <Badge
                                  variant="outline"
                                  className={product.active
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs"
                                    : "border-muted-foreground/30 bg-muted/10 text-muted-foreground text-xs"
                                  }
                                >
                                  {product.active ? "Ativo" : "Inativo"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Tem certeza que deseja excluir "{product.name}"? Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteProduct.mutate(product.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Excluir
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border/40 gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Mostrar</span>
                      <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                        <SelectTrigger className="w-[70px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>por página</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">{page} / {totalPages || 1}</span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Package className="mb-4 h-12 w-12 opacity-20" />
                  <p className="text-lg font-medium">Nenhum produto encontrado</p>
                  <p className="text-sm">Clique em "Novo Produto" para começar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== SUPPLIERS TAB ===== */}
        <TabsContent value="suppliers" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setSupplierDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {suppliers && suppliers.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead className="w-[80px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliers.map((sup) => (
                        <TableRow key={sup.id}>
                          <TableCell className="font-medium">{sup.name}</TableCell>
                          <TableCell className="font-mono text-xs">{sup.cnpj || "—"}</TableCell>
                          <TableCell>{sup.email || "—"}</TableCell>
                          <TableCell>{sup.phone || "—"}</TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
                                  <AlertDialogDescription>Tem certeza que deseja excluir "{sup.name}"?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteSupplier.mutate(sup.id)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Truck className="mb-4 h-12 w-12 opacity-30" />
                  <p className="text-lg font-medium">Nenhum fornecedor cadastrado</p>
                  <p className="text-sm">Clique em "Novo Fornecedor" para começar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Produtos</DialogTitle>
            <DialogDescription>Baixe o modelo, preencha e faça o upload.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button variant="outline" className="w-full" onClick={() => {
              const csv = "SKU,Nome,Categoria,Custo,Preço,Estoque\nSKU-001,Produto Exemplo,Geral,10.00,29.90,100";
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "modelo-produtos.csv"; a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="mr-2 h-4 w-4" /> Baixar modelo CSV
            </Button>
            <div className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Arraste o arquivo aqui ou clique para selecionar</p>
              <input type="file" accept=".csv,.xlsx" className="hidden" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
            <Button disabled>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={(open) => { setProductDialogOpen(open); if (!open) setEditingProduct(null); }}
        product={editingProduct}
      />
      <SupplierFormDialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen} />
    </div>
  );
};

export default Produtos;
