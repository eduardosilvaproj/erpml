import { useState, useMemo, useCallback } from "react";
import {
  Warehouse, Search, Loader2, Download, AlertTriangle,
  ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAllProducts } from "@/hooks/useProductData";
import { useCompanyId } from "@/hooks/useCompanyId";
import { formatNumber, formatCurrency, formatDifference } from "@/lib/formatters";

type SortField = "sku" | "name" | "stock_full" | "stock_physical" | "diferenca" | "price" | "total";
type SortDir = "asc" | "desc";

const RelatorioEstoqueFull = () => {
  const { toast } = useToast();
  const companyId = useCompanyId();
  const { data, isLoading } = useAllProducts();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const allProducts = data?.products || [];

  // Filter: active products with stock_full > 0
  const filtered = useMemo(() => {
    let list = allProducts.filter(
      (p) => p.active && (p.stock_full ?? 0) > 0
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
      const aFull = a.stock_full ?? 0;
      const bFull = b.stock_full ?? 0;
      const aPhys = a.stock_physical ?? 0;
      const bPhys = b.stock_physical ?? 0;
      switch (sortField) {
        case "sku":
          return (a.sku || "").localeCompare(b.sku || "") * dir;
        case "name":
          return (a.name || "").localeCompare(b.name || "") * dir;
        case "stock_full":
          return (aFull - bFull) * dir;
        case "stock_physical":
          return (aPhys - bPhys) * dir;
        case "diferenca":
          return ((aFull - aPhys) - (bFull - bPhys)) * dir;
        case "price":
          return (getMlPrice(a) - getMlPrice(b)) * dir;
        case "total":
          return (aFull * getMlPrice(a) - bFull * getMlPrice(b)) * dir;
        default:
          return 0;
      }
    });

    return list;
  }, [allProducts, search, sortField, sortDir]);

  // Products in FULL but with zero physical stock
  const semFisico = useMemo(
    () => filtered.filter((p) => (p.stock_physical ?? 0) === 0),
    [filtered]
  );

  const totalFull = filtered.length;
  const totalFullUnits = filtered.reduce((s, p) => s + (p.stock_full ?? 0), 0);
  // Helper to get ML price from linked products
  const getMlPrice = (p: any): number => {
    const linked = p.ml_linked_products;
    if (linked && linked.length > 0 && linked[0].ml_price != null) {
      return linked[0].ml_price;
    }
    return p.price ?? 0;
  };

  const totalFullValue = filtered.reduce((s, p) => s + (p.stock_full ?? 0) * getMlPrice(p), 0);

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
      toast({ title: "Nenhum dado", description: "Nenhum produto com estoque FULL.", variant: "destructive" });
      return;
    }
    const lines = [
      "SKU,Nome,Estoque FULL,Estoque Físico,Diferença,Preço Venda ML,Valor Total FULL",
      ...filtered.map((p) => {
        const full = p.stock_full ?? 0;
        const phys = p.stock_physical ?? 0;
        return `"${p.sku}","${p.name}",${full},${phys},${full - phys},${getMlPrice(p)},${(full * getMlPrice(p)).toFixed(2)}`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estoque-full-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Relatório exportado!", description: "CSV baixado com sucesso." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-primary" />
            Relatório de Estoque FULL
          </h1>
          <p className="text-muted-foreground">
            Produtos ativos com estoque FULL maior que zero
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Warehouse className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Produtos FULL</p>
              <p className="text-2xl font-bold">{formatNumber(totalFull)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Warehouse className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Total FULL</p>
              <p className="text-2xl font-bold">{formatCurrency(totalFullValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-destructive/10 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sem Estoque Físico</p>
              <p className="text-2xl font-bold text-destructive">{formatNumber(semFisico.length)}</p>
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
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("stock_full")}>
                      Estoque FULL <SortIcon field="stock_full" />
                    </TableHead>
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("stock_physical")}>
                      Estoque Físico <SortIcon field="stock_physical" />
                    </TableHead>
                    <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort("diferenca")}>
                      Diferença <SortIcon field="diferenca" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("price")}>
                      Preço Venda ML <SortIcon field="price" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("total")}>
                      Valor Total FULL <SortIcon field="total" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const full = p.stock_full ?? 0;
                    const phys = p.stock_physical ?? 0;
                    const diff = full - phys;
                    const mlPrice = getMlPrice(p);
                    const total = full * mlPrice;
                    const semEstoqueFisico = phys === 0;
                    return (
                      <TableRow
                        key={p.id}
                        className={semEstoqueFisico ? "bg-destructive/5" : ""}
                      >
                        <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                        <TableCell className="font-medium max-w-[250px] truncate" title={p.name}>
                          {p.name}
                          {semEstoqueFisico && (
                            <Badge variant="destructive" className="ml-2 text-[10px] h-5">
                              Sem Físico
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold">{formatNumber(full)}</TableCell>
                        <TableCell className="text-center">{formatNumber(phys)}</TableCell>
                        <TableCell className="text-center font-bold">
                          <span className={diff > 0 ? "text-destructive" : diff < 0 ? "text-primary" : "text-muted-foreground"}>
                            {formatDifference(diff)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(mlPrice)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Warehouse className="mb-4 h-12 w-12 opacity-30" />
              <p>{search ? "Nenhum produto encontrado para esta busca" : "Nenhum produto com estoque FULL cadastrado"}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RelatorioEstoqueFull;
