import { useState } from "react";
import { Warehouse, Package, ArrowRightLeft, AlertTriangle, Search, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useProducts, useCategories } from "@/hooks/useProductData";

const Estoque = () => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [onlyDivergent, setOnlyDivergent] = useState(false);
  const [validationSearch, setValidationSearch] = useState("");

  const { data, isLoading } = useProducts({
    search: search || undefined,
    category_id: categoryFilter || undefined,
    page,
    pageSize: 50,
    sortBy: "name",
    sortOrder: "asc",
  });
  const { data: categories } = useCategories();

  const products = data?.products || [];

  // Calculate totals
  const totalPhysical = products.reduce((s, p) => s + p.stock_physical, 0);
  const totalFull = products.reduce((s, p) => s + p.stock_full, 0);
  const lowStock = products.filter((p) => (p.stock_physical + p.stock_full) <= p.min_stock && p.min_stock > 0);

  // Apply stock filter
  const filtered = stockFilter === "low"
    ? products.filter((p) => (p.stock_physical + p.stock_full) <= p.min_stock && p.min_stock > 0)
    : stockFilter === "zero"
      ? products.filter((p) => p.stock_physical + p.stock_full === 0)
      : products;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Controle de Estoque</h1>
        <p className="text-muted-foreground">Estoque Físico + FULL (Mercado Livre)</p>
      </div>

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
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Físico</TableHead>
                  <TableHead className="text-center">FULL</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Mínimo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const total = p.stock_physical + p.stock_full;
                  const isLow = p.min_stock > 0 && total <= p.min_stock;
                  const isZero = total === 0;
                  return (
                    <TableRow key={p.id} className={isZero ? "bg-destructive/5" : isLow ? "bg-amber-50/50" : ""}>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        {p.categories?.name && <Badge variant="secondary">{p.categories.name}</Badge>}
                      </TableCell>
                      <TableCell className="text-center font-bold text-primary">{p.stock_physical}</TableCell>
                      <TableCell className="text-center font-bold text-accent">{p.stock_full}</TableCell>
                      <TableCell className="text-center font-bold">{total}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{p.min_stock}</TableCell>
                      <TableCell>
                        {isZero ? (
                          <Badge variant="destructive">Sem estoque</Badge>
                        ) : isLow ? (
                          <Badge className="bg-amber-500/15 text-amber-700">Baixo</Badge>
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

      {/* Validação de Estoque: Físico vs FULL */}
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
                {/* Summary cards */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                  <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                      <Warehouse className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Total Físico</p>
                        <p className="text-xl font-bold">{totalPhys}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                      <Package className="h-5 w-5 text-accent" />
                      <div>
                        <p className="text-xs text-muted-foreground">Total FULL</p>
                        <p className="text-xl font-bold">{totalF}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                      <ArrowRightLeft className={`h-5 w-5 ${diff !== 0 ? "text-destructive" : "text-emerald-600"}`} />
                      <div>
                        <p className="text-xs text-muted-foreground">Diferença</p>
                        <p className={`text-xl font-bold ${diff !== 0 ? "text-destructive" : "text-emerald-600"}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                      <ShieldAlert className={`h-5 w-5 ${divergentCount > 0 ? "text-amber-600" : "text-emerald-600"}`} />
                      <div>
                        <p className="text-xs text-muted-foreground">Com Divergência</p>
                        <p className="text-xl font-bold">{divergentCount}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produto..."
                      className="pl-10"
                      value={validationSearch}
                      onChange={(e) => setValidationSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="only-divergent"
                      checked={onlyDivergent}
                      onCheckedChange={setOnlyDivergent}
                    />
                    <Label htmlFor="only-divergent" className="text-sm cursor-pointer">
                      Apenas divergentes
                    </Label>
                  </div>
                </div>

                {/* Detailed table */}
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
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
                                <span className={hasDivergence ? "text-destructive" : "text-emerald-600"}>
                                  {d > 0 ? `+${d}` : d}
                                </span>
                              </TableCell>
                              <TableCell>
                                {hasDivergence ? (
                                  <Badge variant="destructive" className="gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Divergente
                                  </Badge>
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
                    <p className="text-sm">
                      {onlyDivergent ? "Nenhum produto com divergência encontrado" : "Nenhum produto encontrado"}
                    </p>
                  </div>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

export default Estoque;
