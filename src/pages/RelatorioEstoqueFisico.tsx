import { useState, useMemo, useCallback } from "react";
import {
  Package, Search, Loader2, Download, Printer,
  ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAllProducts } from "@/hooks/useProductData";
import { useCompanyId } from "@/hooks/useCompanyId";
import { formatNumber, formatCurrency } from "@/lib/formatters";

type SortField = "sku" | "name" | "stock_physical" | "cost" | "price" | "total";
type SortDir = "asc" | "desc";

const RelatorioEstoqueFisico = () => {
  const { toast } = useToast();
  const companyId = useCompanyId();
  const { data, isLoading } = useAllProducts();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const allProducts = data?.products || [];

  // Filter: active products with stock_physical > 0
  const filtered = useMemo(() => {
    let list = allProducts.filter(
      (p) => p.active && (p.stock_physical ?? 0) > 0
    );

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(s) ||
          p.sku?.toLowerCase().includes(s) ||
          p.ean?.toLowerCase().includes(s) ||
          p.barcode?.toLowerCase().includes(s)
      );
    }

    // Sort
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "sku":
          return (a.sku || "").localeCompare(b.sku || "") * dir;
        case "name":
          return (a.name || "").localeCompare(b.name || "") * dir;
        case "stock_physical":
          return ((a.stock_physical ?? 0) - (b.stock_physical ?? 0)) * dir;
        case "cost":
          return ((a.cost ?? 0) - (b.cost ?? 0)) * dir;
        case "price":
          return ((a.price ?? 0) - (b.price ?? 0)) * dir;
        case "total":
          return ((a.stock_physical ?? 0) * (a.cost ?? 0) - (b.stock_physical ?? 0) * (b.cost ?? 0)) * dir;
        default:
          return 0;
      }
    });

    return list;
  }, [allProducts, search, sortField, sortDir]);

  const totalProducts = filtered.length;
  const totalUnits = filtered.reduce((s, p) => s + (p.stock_physical ?? 0), 0);
  const totalValue = filtered.reduce((s, p) => s + (p.stock_physical ?? 0) * (p.cost ?? 0), 0);

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return field;
    });
  }, []);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 inline" />
      : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast({ title: "Nenhum dado", description: "Nenhum produto com estoque físico.", variant: "destructive" });
      return;
    }
    const lines = [
      "SKU,Nome,Unidades,Preço Custo,Preço Médio,Valor Total",
      ...filtered.map((p) =>
        `"${p.sku}","${p.name}",${p.stock_physical ?? 0},${p.cost ?? 0},${p.price ?? 0},${((p.stock_physical ?? 0) * (p.cost ?? 0)).toFixed(2)}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estoque-fisico-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Relatório exportado!", description: "CSV baixado com sucesso." });
  };

  const exportPDF = () => {
    if (filtered.length === 0) {
      toast({ title: "Nenhum dado", description: "Nenhum produto com estoque físico.", variant: "destructive" });
      return;
    }
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Relatório de Estoque Físico
          </h1>
          <p className="text-muted-foreground">
            Produtos ativos com estoque físico maior que zero
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={exportPDF}>
            <Printer className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Produtos</p>
              <p className="text-2xl font-bold">{formatNumber(totalProducts)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Unidades</p>
              <p className="text-2xl font-bold">{formatNumber(totalUnits)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Total Estoque</p>
              <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, SKU ou código de barras..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("sku")}>
                      SKU <SortIcon field="sku" />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                      Nome <SortIcon field="name" />
                    </TableHead>
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("stock_physical")}>
                      Unidades <SortIcon field="stock_physical" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("cost")}>
                      Preço Custo <SortIcon field="cost" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("price")}>
                      Preço Médio <SortIcon field="price" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("total")}>
                      Valor Total <SortIcon field="total" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const units = p.stock_physical ?? 0;
                    const cost = p.cost ?? 0;
                    const total = units * cost;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                        <TableCell className="font-medium max-w-[250px] truncate" title={p.name}>
                          {p.name}
                        </TableCell>
                        <TableCell className="text-center font-bold">{formatNumber(units)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.price ?? 0)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="mb-4 h-12 w-12 opacity-30" />
              <p>{search ? "Nenhum produto encontrado para esta busca" : "Nenhum produto com estoque físico cadastrado"}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RelatorioEstoqueFisico;
