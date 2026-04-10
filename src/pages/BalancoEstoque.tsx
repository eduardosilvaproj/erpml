import { useState, useMemo } from "react";
import {
  ClipboardList, Search, Loader2, AlertTriangle, CheckCircle2,
  FileText, Download, Plus, Minus, Save, RotateCcw, PackageCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useProducts, useCategories } from "@/hooks/useProductData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCompanyId } from "@/hooks/useCompanyId";

interface CountItem {
  productId: string;
  counted: number | null;
}

const BalancoEstoque = () => {
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [onlyDivergent, setOnlyDivergent] = useState(false);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [isCounting, setIsCounting] = useState(false);
  const [monthsBack, setMonthsBack] = useState("3");

  const { data, isLoading } = useProducts({
    search: search || undefined,
    category_id: categoryFilter || undefined,
    page: 1,
    pageSize: 500,
    sortBy: "name",
    sortOrder: "asc",
  });
  const { data: categories } = useCategories();
  const products = data?.products || [];

  // Fetch invoices from the last N months for comparison
  const sinceDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - parseInt(monthsBack));
    return d.toISOString();
  }, [monthsBack]);

  const { data: invoiceEntries, isLoading: loadingInvoices } = useQuery({
    queryKey: ["balance-invoices", companyId, sinceDate],
    queryFn: async () => {
      if (!companyId) return [];
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, number, issuer_name, imported_at, total_value")
        .eq("company_id", companyId)
        .gte("imported_at", sinceDate)
        .order("imported_at", { ascending: false });

      if (!invoices?.length) return [];

      const invoiceIds = invoices.map((i) => i.id);
      const { data: items } = await supabase
        .from("invoice_items")
        .select("product_id, quantity, xml_description, invoice_id")
        .in("invoice_id", invoiceIds)
        .not("product_id", "is", null);

      // Aggregate quantities per product from invoices
      const byProduct: Record<string, { totalQty: number; invoiceCount: number; descriptions: string[] }> = {};
      for (const item of items || []) {
        if (!item.product_id) continue;
        if (!byProduct[item.product_id]) {
          byProduct[item.product_id] = { totalQty: 0, invoiceCount: 0, descriptions: [] };
        }
        byProduct[item.product_id].totalQty += Number(item.quantity);
        byProduct[item.product_id].invoiceCount++;
        if (!byProduct[item.product_id].descriptions.includes(item.xml_description)) {
          byProduct[item.product_id].descriptions.push(item.xml_description);
        }
      }

      return { invoices, byProduct, totalInvoices: invoices.length };
    },
    enabled: !!companyId,
  });

  const invoiceData = invoiceEntries as { invoices: any[]; byProduct: Record<string, { totalQty: number; invoiceCount: number; descriptions: string[] }>; totalInvoices: number } | undefined;

  const startCounting = () => {
    setIsCounting(true);
    const initial: Record<string, number | null> = {};
    products.forEach((p) => { initial[p.id] = null; });
    setCounts(initial);
    toast({ title: "Balanço iniciado", description: "Insira a contagem física de cada produto." });
  };

  const resetCounting = () => {
    setIsCounting(false);
    setCounts({});
  };

  const updateCount = (productId: string, value: string) => {
    const num = value === "" ? null : parseInt(value, 10);
    setCounts((prev) => ({ ...prev, [productId]: isNaN(num as number) ? null : num }));
  };

  // Compute divergences
  const divergences = useMemo(() => {
    if (!isCounting) return [];
    return products
      .map((p) => {
        const counted = counts[p.id];
        if (counted === null || counted === undefined) return null;
        const registered = p.stock_physical;
        const diff = counted - registered;
        const invoiceInfo = invoiceData?.byProduct?.[p.id];
        return {
          product: p,
          counted,
          registered,
          diff,
          invoiceQtyEntered: invoiceInfo?.totalQty || 0,
          invoiceCount: invoiceInfo?.invoiceCount || 0,
        };
      })
      .filter(Boolean) as Array<{
        product: typeof products[0];
        counted: number;
        registered: number;
        diff: number;
        invoiceQtyEntered: number;
        invoiceCount: number;
      }>;
  }, [products, counts, isCounting, invoiceData]);

  const divergentItems = divergences.filter((d) => d.diff !== 0);
  const matchedItems = divergences.filter((d) => d.diff === 0);
  const totalCounted = divergences.length;
  const totalDivergent = divergentItems.length;
  const totalSurplus = divergentItems.filter((d) => d.diff > 0).reduce((s, d) => s + d.diff, 0);
  const totalDeficit = divergentItems.filter((d) => d.diff < 0).reduce((s, d) => s + Math.abs(d.diff), 0);

  const displayedDivergences = onlyDivergent ? divergentItems : divergences;

  const exportReport = () => {
    if (divergences.length === 0) {
      toast({ title: "Nenhum dado", description: "Realize a contagem primeiro.", variant: "destructive" });
      return;
    }

    const lines = [
      "SKU,Produto,Estoque Registrado,Contagem Física,Diferença,Entrada NF (últimos meses),Status",
      ...divergences.map((d) =>
        `"${d.product.sku}","${d.product.name}",${d.registered},${d.counted},${d.diff},${d.invoiceQtyEntered},${d.diff === 0 ? "OK" : d.diff > 0 ? "Sobra" : "Falta"}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balanco-estoque-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Relatório exportado!", description: "CSV baixado com sucesso." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Balanço de Estoque
          </h1>
          <p className="text-muted-foreground">Contagem física do inventário com comparação de notas fiscais</p>
        </div>
        <div className="flex gap-2">
          {!isCounting ? (
            <Button onClick={startCounting} disabled={isLoading || products.length === 0}>
              <PackageCheck className="h-4 w-4 mr-2" />
              Iniciar Balanço
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={resetCounting}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button variant="outline" onClick={exportReport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Itens Contados</p>
              <p className="text-2xl font-bold">{totalCounted}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-destructive/10 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Divergências</p>
              <p className="text-2xl font-bold text-destructive">{totalDivergent}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Plus className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Sobras</p>
              <p className="text-2xl font-bold text-emerald-600">+{totalSurplus}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Minus className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Faltas</p>
              <p className="text-2xl font-bold text-amber-600">-{totalDeficit}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="counting" className="space-y-4">
        <TabsList>
          <TabsTrigger value="counting">Contagem</TabsTrigger>
          <TabsTrigger value="report">Relatório de Divergências</TabsTrigger>
          <TabsTrigger value="invoices">Notas Fiscais Referência</TabsTrigger>
        </TabsList>

        {/* Tab: Contagem */}
        <TabsContent value="counting" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
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
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : products.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-center">Est. Registrado</TableHead>
                        <TableHead className="text-center">Entrada NF</TableHead>
                        {isCounting && <TableHead className="text-center">Contagem Física</TableHead>}
                        {isCounting && <TableHead className="text-center">Diferença</TableHead>}
                        {isCounting && <TableHead>Status</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((p) => {
                        const counted = counts[p.id];
                        const diff = counted != null ? counted - p.stock_physical : null;
                        const invoiceInfo = invoiceData?.byProduct?.[p.id];
                        return (
                          <TableRow key={p.id} className={diff != null && diff !== 0 ? "bg-destructive/5" : ""}>
                            <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="text-center font-bold">{p.stock_physical}</TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {invoiceInfo ? invoiceInfo.totalQty : "—"}
                            </TableCell>
                            {isCounting && (
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-20 mx-auto text-center"
                                  value={counted ?? ""}
                                  onChange={(e) => updateCount(p.id, e.target.value)}
                                  placeholder="0"
                                />
                              </TableCell>
                            )}
                            {isCounting && (
                              <TableCell className="text-center font-bold">
                                {diff != null ? (
                                  <span className={diff === 0 ? "text-emerald-600" : "text-destructive"}>
                                    {diff > 0 ? `+${diff}` : diff}
                                  </span>
                                ) : "—"}
                              </TableCell>
                            )}
                            {isCounting && (
                              <TableCell>
                                {diff == null ? (
                                  <Badge variant="secondary">Pendente</Badge>
                                ) : diff === 0 ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-700 gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> OK
                                  </Badge>
                                ) : diff > 0 ? (
                                  <Badge className="bg-blue-500/15 text-blue-700 gap-1">
                                    <Plus className="h-3 w-3" /> Sobra
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="gap-1">
                                    <Minus className="h-3 w-3" /> Falta
                                  </Badge>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ClipboardList className="mb-4 h-12 w-12 opacity-30" />
                  <p>Nenhum produto cadastrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Relatório */}
        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Relatório de Divergências
                </CardTitle>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch id="only-div" checked={onlyDivergent} onCheckedChange={setOnlyDivergent} />
                    <Label htmlFor="only-div" className="text-sm cursor-pointer">Apenas divergentes</Label>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportReport}>
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!isCounting || divergences.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ClipboardList className="mb-4 h-10 w-10 opacity-30" />
                  <p className="text-sm">
                    {!isCounting
                      ? "Inicie o balanço para ver o relatório de divergências"
                      : "Insira a contagem física dos produtos para gerar o relatório"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-center">Registrado</TableHead>
                        <TableHead className="text-center">Contado</TableHead>
                        <TableHead className="text-center">Diferença</TableHead>
                        <TableHead className="text-center">Entrada NF</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedDivergences.map((d) => (
                        <TableRow key={d.product.id} className={d.diff !== 0 ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-xs">{d.product.sku}</TableCell>
                          <TableCell className="font-medium">{d.product.name}</TableCell>
                          <TableCell className="text-center">{d.registered}</TableCell>
                          <TableCell className="text-center font-bold">{d.counted}</TableCell>
                          <TableCell className="text-center font-bold">
                            <span className={d.diff === 0 ? "text-emerald-600" : "text-destructive"}>
                              {d.diff > 0 ? `+${d.diff}` : d.diff}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {d.invoiceQtyEntered > 0 ? `${d.invoiceQtyEntered} (${d.invoiceCount} NFs)` : "—"}
                          </TableCell>
                          <TableCell>
                            {d.diff === 0 ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700">OK</Badge>
                            ) : d.diff > 0 ? (
                              <Badge className="bg-blue-500/15 text-blue-700">Sobra</Badge>
                            ) : (
                              <Badge variant="destructive">Falta</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Notas Fiscais */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Notas Fiscais de Referência
                </CardTitle>
                <Select value={monthsBack} onValueChange={setMonthsBack}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Último mês</SelectItem>
                    <SelectItem value="3">Últimos 3 meses</SelectItem>
                    <SelectItem value="6">Últimos 6 meses</SelectItem>
                    <SelectItem value="12">Último ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingInvoices ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : invoiceData?.invoices?.length ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    {invoiceData.totalInvoices} nota(s) fiscal(is) importada(s) nos últimos {monthsBack} meses
                  </p>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Data Importação</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceData.invoices.map((inv: any) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-mono">{inv.number}</TableCell>
                            <TableCell>{inv.issuer_name || "—"}</TableCell>
                            <TableCell>{new Date(inv.imported_at).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell className="text-right font-bold">
                              R$ {Number(inv.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="mb-4 h-10 w-10 opacity-30" />
                  <p className="text-sm">Nenhuma nota fiscal encontrada no período selecionado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info card */}
      <Card>
        <CardContent className="p-4">
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm font-medium text-foreground">Como funciona o Balanço de Estoque</p>
            <p className="text-xs text-muted-foreground mt-1">
              1. Inicie o balanço • 2. Insira a contagem física de cada produto • 3. Compare com o estoque registrado e as NFs de entrada • 4. Exporte o relatório CSV
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BalancoEstoque;
