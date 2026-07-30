import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, DollarSign, TrendingDown, Search, ArrowUpDown, Loader2, Percent } from "lucide-react";

interface ProductWithML {
  id: string;
  sku: string;
  name: string;
  cost: number;
  price: number;
  ml_price: number | null;
  ml_original_price: number | null;
  ml_item_id: string | null;
  ml_title: string | null;
  ml_status: string | null;
}

interface SummaryCards {
  total: number;
  margemNegativa: number;
  alerta: number;
}

interface ProductEnriched extends ProductWithML {
  margin: number;
  costWithTax: number;
  marginWithTax: number;
}

function getMarginClass(margin: number): string {
  if (margin < 0) return "text-red-500 font-bold";
  if (margin < 10) return "text-red-400 font-semibold";
  if (margin < 20) return "text-yellow-400 font-semibold";
  return "text-green-400";
}

function getBadgeVariant(margin: number): "destructive" | "warning" | "success" | "secondary" {
  if (margin < 0) return "destructive";
  if (margin < 10) return "warning";
  if (margin < 20) return "secondary";
  return "success";
}

function getBadgeLabel(margin: number): string {
  if (margin < 0) return "Prejuízo";
  if (margin < 10) return "Crítico";
  if (margin < 20) return "Atenção";
  return "Ok";
}

export default function ConciliacaoPrecos() {
  const companyId = useCompanyId();
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [aliquota, setAliquota] = useState(0); // % de imposto sobre o custo

  const { data: products, isLoading, error } = useQuery({
    queryKey: ["conciliacao-precos", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          sku,
          name,
          cost,
          price,
          ml_linked_products (
            ml_price,
            ml_original_price,
            ml_item_id,
            ml_title,
            ml_status
          )
        `)
        .eq("company_id", companyId)
        .gt("cost", 0)
        .not("ml_linked_products", "is", null);

      if (error) throw error;

      const result: ProductWithML[] = [];

      for (const row of data) {
        const links = row.ml_linked_products as Array<{
          ml_price: number | null;
          ml_original_price: number | null;
          ml_item_id: string;
          ml_title: string | null;
          ml_status: string | null;
        }> | null;

        if (!links || links.length === 0) continue;

        for (const link of links) {
          if (link.ml_price == null || link.ml_price <= 0) continue;

          result.push({
            id: row.id,
            sku: row.sku,
            name: row.name,
            cost: row.cost,
            price: row.price,
            ml_price: link.ml_price,
            ml_original_price: link.ml_original_price,
            ml_item_id: link.ml_item_id,
            ml_title: link.ml_title,
            ml_status: link.ml_status,
          });
        }
      }

      return result;
    },
  });

  const enriched = useMemo(() => {
    if (!products) return [];
    return products.map((p) => {
      const margin = p.ml_price && p.ml_price > 0
        ? ((p.ml_price - p.cost) / p.ml_price) * 100
        : 0;
      const costWithTax = p.cost * (1 + aliquota / 100);
      const marginWithTax = p.ml_price && p.ml_price > 0
        ? ((p.ml_price - costWithTax) / p.ml_price) * 100
        : 0;
      return { ...p, margin, costWithTax, marginWithTax };
    });
  }, [products, aliquota]);

  const filtered = useMemo(() => {
    if (!search.trim()) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(
      (p) =>
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.ml_title && p.ml_title.toLowerCase().includes(q))
    );
  }, [enriched, search]);

  const sorted = useMemo(() => {
    const sortKey = aliquota > 0 ? "marginWithTax" : "margin";
    return [...filtered].sort((a, b) =>
      sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]
    );
  }, [filtered, sortAsc, aliquota]);

  const summary: SummaryCards = useMemo(() => {
    const sortKey = aliquota > 0 ? "marginWithTax" : "margin";
    return {
      total: enriched.length,
      margemNegativa: enriched.filter((p) => p[sortKey] < 0).length,
      alerta: enriched.filter((p) => p[sortKey] >= 0 && p[sortKey] < 20).length,
    };
  }, [enriched, aliquota]);

  const toggleSort = () => setSortAsc((prev) => !prev);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <AlertTriangle className="h-5 w-5 mr-2" />
        Erro ao carregar dados: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <DollarSign className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Conciliação de Preços NF vs ML</h1>
          <p className="text-muted-foreground text-sm">
            Compare preços de custo (NF) com preços praticados no Mercado Livre
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total de Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.total}</p>
            <p className="text-xs text-muted-foreground mt-1">produtos com anúncio no ML</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Margem Negativa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">{summary.margemNegativa}</p>
            <p className="text-xs text-muted-foreground mt-1">preço ML abaixo do custo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              Em Alerta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-400">{summary.alerta}</p>
            <p className="text-xs text-muted-foreground mt-1">margem entre 0% e 20%</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Sort Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por SKU, nome ou título do anúncio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            placeholder="Alíquota %"
            value={aliquota || ""}
            onChange={(e) => setAliquota(Number(e.target.value) || 0)}
            className="w-24 text-sm font-mono"
          />
        </div>
        <Button variant="outline" size="sm" onClick={toggleSort} className="gap-1.5">
          <ArrowUpDown className="h-4 w-4" />
          {sortAsc ? "Margem (crescente)" : "Margem (decrescente)"}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Preço Custo (NF)</TableHead>
                <TableHead className="text-right">Custo c/ Imposto</TableHead>
                <TableHead className="text-right">Preço ML</TableHead>
                <TableHead className="text-right">Preço Promocional</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-right">Margem %</TableHead>
                <TableHead className="text-right">Margem c/ Imposto</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    {search ? "Nenhum produto encontrado para esta busca." : "Nenhum produto com anúncio no ML encontrado."}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((p) => {
                  const diff = p.ml_price - p.cost;
                  const diffWithTax = p.ml_price - p.costWithTax;
                  return (
                    <TableRow key={`${p.id}-${p.ml_item_id}`}>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[250px]">{p.name}</span>
                          {p.ml_title && (
                            <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                              {p.ml_title}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(p.cost)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-amber-400">
                        {aliquota > 0 ? formatCurrency(p.costWithTax) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(p.ml_price)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.ml_original_price != null && p.ml_original_price > p.ml_price ? (
                            <>
                              <span className="line-through text-muted-foreground">
                                {formatCurrency(p.ml_original_price)}
                              </span>
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                                Em Promoção
                              </Badge>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${diff < 0 ? "text-red-500" : "text-green-400"}`}>
                        {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${getMarginClass(p.margin)}`}>
                        {p.margin.toFixed(1)}%
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${aliquota > 0 ? getMarginClass(p.marginWithTax) : "text-muted-foreground"}`}>
                        {aliquota > 0 ? `${p.marginWithTax.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getBadgeVariant(aliquota > 0 ? p.marginWithTax : p.margin)}>
                          {getBadgeLabel(aliquota > 0 ? p.marginWithTax : p.margin)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
