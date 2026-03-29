import { useState, useCallback } from "react";
import { Package, Plus, Search, BarChart3, Pencil, Trash2, ChevronLeft, ChevronRight, Loader2, Truck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useProducts, useCategories, useSuppliers, useDeleteProduct, useDeleteSupplier, type Product } from "@/hooks/useProductData";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { SupplierFormDialog } from "@/components/SupplierFormDialog";
import { enrichProduct } from "@/lib/enrich-product";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 10;

const Produtos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0, name: "" });

  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const { data, isLoading } = useProducts({
    search: search || undefined,
    category_id: categoryFilter || undefined,
    supplier_id: supplierFilter || undefined,
    page,
    pageSize: PAGE_SIZE,
    sortBy,
    sortOrder,
  });
  const deleteProduct = useDeleteProduct();
  const deleteSupplier = useDeleteSupplier();

  const handleBatchEnrich = useCallback(async () => {
    setEnriching(true);
    try {
      // Fetch ALL products with missing fields (not just current page)
      const { data: allProducts, error } = await supabase
        .from("products")
        .select("id, name, barcode, description, weight, width, height, depth, price")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const incomplete = (allProducts || []).filter(
        (p) =>
          !p.description ||
          p.description.length < 10 ||
          p.weight == null ||
          p.width == null ||
          p.height == null ||
          p.depth == null
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
          const enriched = await enrichProduct({
            productName: prod.name,
            ean: prod.barcode || undefined,
          });

          const updates: Record<string, any> = {};
          if (enriched.description && (!prod.description || prod.description.length < 10)) {
            updates.description = enriched.description;
          }
          if (enriched.weight_kg != null && prod.weight == null) updates.weight = enriched.weight_kg;
          if (enriched.width_cm != null && prod.width == null) updates.width = enriched.width_cm;
          if (enriched.height_cm != null && prod.height == null) updates.height = enriched.height_cm;
          if (enriched.depth_cm != null && prod.depth == null) updates.depth = enriched.depth_cm;
          if (enriched.suggested_price_brl != null && prod.price === 0) {
            updates.price = enriched.suggested_price_brl;
          }

          if (Object.keys(updates).length > 0) {
            await supabase.from("products").update(updates).eq("id", prod.id);
            successCount++;
          }
        } catch {
          // Skip failed items, continue with next
        }

        // Small delay to avoid rate limiting
        if (i < incomplete.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Atualização com IA concluída!",
        description: `${successCount} de ${incomplete.length} produto(s) atualizado(s).`,
      });
    } catch (err: any) {
      toast({ title: "Erro na atualização", description: err.message, variant: "destructive" });
    } finally {
      setEnriching(false);
      setEnrichProgress({ current: 0, total: 0, name: "" });
    }
  }, [toast, queryClient]);

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="products">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cadastro de Produtos</h1>
            <p className="text-muted-foreground">Gerencie seu catálogo de produtos e fornecedores</p>
          </div>
          <TabsList>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          </TabsList>
        </div>

        {/* ===== PRODUCTS TAB ===== */}
        <TabsContent value="products" className="space-y-4 mt-4">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[
              { label: "Total", value: data?.total ?? 0, icon: Package },
              { label: "Ativos", value: data?.products?.filter((p) => p.active).length ?? 0, icon: BarChart3 },
              { label: "Sem Estoque", value: data?.products?.filter((p) => p.stock_physical + p.stock_full === 0).length ?? 0, icon: Package },
              { label: "Fornecedores", value: suppliers?.length ?? 0, icon: Truck },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, SKU ou código de barras..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === "all" ? "" : v); setPage(1); }}>
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
                <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos fornecedores</SelectItem>
                    {suppliers?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={handleBatchEnrich}
                  disabled={enriching}
                >
                  {enriching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {enriching ? "Atualizando..." : "Atualizar com IA"}
                </Button>
                <Button onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Produto
                </Button>
              </div>
              {enriching && enrichProgress.total > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Enriquecendo: {enrichProgress.name}</span>
                    <span>{enrichProgress.current}/{enrichProgress.total}</span>
                  </div>
                  <Progress value={(enrichProgress.current / enrichProgress.total) * 100} />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : data?.products && data.products.length > 0 ? (
                <>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("sku")}>
                          SKU {sortBy === "sku" && (sortOrder === "asc" ? "↑" : "↓")}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                          Nome {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                        </TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => handleSort("cost")}>
                          Custo {sortBy === "cost" && (sortOrder === "asc" ? "↑" : "↓")}
                        </TableHead>
                        <TableHead className="cursor-pointer text-right" onClick={() => handleSort("price")}>
                          Preço {sortBy === "price" && (sortOrder === "asc" ? "↑" : "↓")}
                        </TableHead>
                        <TableHead className="text-center">Físico</TableHead>
                        <TableHead className="text-center">FULL</TableHead>
                        <TableHead>Fornecedores</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>
                            {product.categories?.name && (
                              <Badge variant="secondary">{product.categories.name}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(product.cost)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                          <TableCell className="text-center">{product.stock_physical}</TableCell>
                          <TableCell className="text-center">{product.stock_full}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {product.product_suppliers?.map((ps) => (
                                <Badge key={ps.supplier_id} variant="outline" className="text-xs">
                                  {ps.suppliers?.name}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
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
                                    <AlertDialogAction onClick={() => deleteProduct.mutate(product.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      {data.total} produto(s) encontrado(s)
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">{page} / {totalPages || 1}</span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="mb-4 h-12 w-12 opacity-30" />
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
              <Plus className="mr-2 h-4 w-4" />
              Novo Fornecedor
            </Button>
          </div>
          <Card>
            <CardContent className="pt-6">
              {suppliers && suppliers.length > 0 ? (
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
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir "{sup.name}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSupplier.mutate(sup.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
