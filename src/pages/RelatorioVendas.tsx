import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinancialMetrics } from "@/hooks/useFinancialMetrics";
import { formatCurrency } from "@/lib/formatters";
import { FileDown, BarChart3, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PeriodKey = "7d" | "14d" | "15d" | "30d" | "39d" | "6m" | "1a";

const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "7d", label: "7 dias", days: 7 },
  { key: "14d", label: "14 dias", days: 14 },
  { key: "15d", label: "15 dias", days: 15 },
  { key: "30d", label: "30 dias", days: 30 },
  { key: "39d", label: "39 dias", days: 39 },
  { key: "6m", label: "6 meses", days: 180 },
  { key: "1a", label: "1 ano", days: 365 },
];

export default function RelatorioVendas() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const { toast } = useToast();
  const selectedPeriod = PERIOD_OPTIONS.find((p) => p.key === period)!;
  const { data: metrics, isLoading } = useFinancialMetrics(selectedPeriod.days);

  const summaryCards = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: "Total Vendas", value: String(metrics.pdvSalesCount + metrics.mlOrdersCount) },
      { label: "Faturamento Bruto", value: formatCurrency(metrics.grossRevenue) },
      { label: "Faturamento Líquido", value: formatCurrency(metrics.netRevenue) },
      { label: "CMV", value: formatCurrency(metrics.cmv) },
      { label: "Margem Média", value: `${metrics.contributionMargin.toFixed(1)}%` },
    ];
  }, [metrics]);

  const handleExportCSV = () => {
    if (!metrics || metrics.salesDetail.length === 0) {
      toast({ title: "Nenhum dado para exportar" });
      return;
    }

    const headers = [
      "Data", "Tipo", "Produto", "Quantidade",
      "Valor Bruto", "Desconto", "Valor Líquido", "Custo", "Margem %",
    ];

    const rows = metrics.salesDetail.map((item) => [
      new Date(item.date).toLocaleDateString("pt-BR"),
      item.type,
      `"${item.productName.replace(/"/g, '""')}"`,
      String(item.quantity),
      item.grossValue.toFixed(2),
      item.discount.toFixed(2),
      item.netValue.toFixed(2),
      item.cost.toFixed(2),
      item.marginPercent.toFixed(1),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_vendas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Relatório exportado em CSV!" });
  };

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Relatorio de Vendas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Analise detalhada de vendas PDV e Mercado Livre
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-xl border border-border/60 p-1 bg-secondary/50 shadow-premium-xs">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all duration-200 ${
                  period === opt.key
                    ? "bg-primary text-primary-foreground shadow-primary-glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExportCSV}>
            <FileDown className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-lg font-bold mt-1">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Detalhamento de Vendas
            {metrics && (
              <span className="text-xs text-muted-foreground font-normal ml-1">
                ({metrics.salesDetail.length} registros)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !metrics || metrics.salesDetail.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="mb-4 h-12 w-12 opacity-30" />
              <p>Nenhuma venda encontrada no periodo</p>
              <p className="text-sm">Tente ampliar o filtro de periodo</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor Bruto</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.salesDetail.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.type === "PDV" ? "default" : "secondary"}>
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate" title={item.productName}>
                        {item.productName}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.grossValue)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {item.discount > 0 ? formatCurrency(item.discount) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.netValue)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(item.cost)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            item.marginPercent >= 20
                              ? "text-emerald-600"
                              : item.marginPercent >= 0
                              ? "text-amber-600"
                              : "text-destructive"
                          }
                        >
                          {item.marginPercent.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
