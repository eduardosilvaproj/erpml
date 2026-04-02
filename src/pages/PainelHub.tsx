import { ShoppingBag, Package, AlertTriangle, Warehouse, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProducts } from "@/hooks/useProductData";
import { useSalesStats, useSales } from "@/hooks/useSalesData";
import { useInvoiceStats } from "@/hooks/useInvoiceData";
import { useTransferOrders } from "@/hooks/useTransferData";
import { useMLConnection, useMLItems, useMLLinkedProducts, useMLOrders } from "@/hooks/useMLData";

const PainelHub = () => {
  const { data: productData } = useProducts({ pageSize: 999 });
  const { data: salesStats } = useSalesStats();
  const { data: recentSales } = useSales({ limit: 5 });
  const { data: invoiceStats } = useInvoiceStats();
  const { data: transfers } = useTransferOrders();
  const { data: mlConnection } = useMLConnection();
  const mlEnabled = !!mlConnection && !mlConnection.needs_reauth;
  const { data: mlItems } = useMLItems(mlEnabled);
  const { data: mlOrders } = useMLOrders(mlEnabled);
  const { data: mlLinked } = useMLLinkedProducts();

  const products = productData?.products || [];
  const totalPhysical = products.reduce((s, p) => s + p.stock_physical, 0);
  const totalFull = products.reduce((s, p) => s + p.stock_full, 0);
  const lowStock = products.filter((p) => p.min_stock > 0 && (p.stock_physical + p.stock_full) <= p.min_stock);
  const pendingTransfers = transfers?.filter((t) => t.status !== "conferido_full" && t.status !== "cancelado") || [];

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const alerts: { message: string; type: "warning" | "error" }[] = [];
  lowStock.forEach((p) => alerts.push({ message: `${p.name} — estoque baixo (${p.stock_physical + p.stock_full}/${p.min_stock})`, type: "warning" }));
  if (invoiceStats && invoiceStats.divergente > 0) {
    alerts.push({ message: `${invoiceStats.divergente} nota(s) divergente(s)`, type: "error" });
  }
  if (invoiceStats && invoiceStats.aguardando > 0) {
    alerts.push({ message: `${invoiceStats.aguardando} nota(s) aguardando conferência`, type: "warning" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel HUB</h1>
        <p className="text-muted-foreground">Visão geral de pedidos, produtos e estoque</p>
      </div>

      {/* Vendas */}
      <div>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Vendas
        </h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[
            { label: "Vendas Hoje", value: salesStats?.salesToday ?? 0 },
            { label: "Faturamento Hoje", value: formatCurrency(salesStats?.revenueToday ?? 0) },
            { label: "Vendas 30d", value: salesStats?.sales30d ?? 0 },
            { label: "Faturamento 30d", value: formatCurrency(salesStats?.revenue30d ?? 0) },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Estoque */}
      <div>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <Warehouse className="h-5 w-5" />
          Estoque
        </h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Produtos</p>
              <p className="text-3xl font-bold">{products.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Físico</p>
              <p className="text-3xl font-bold text-primary">{totalPhysical}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">FULL</p>
              <p className="text-3xl font-bold text-accent">{totalFull}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-3xl font-bold">{totalPhysical + totalFull}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Mercado Livre
        </h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[
            { label: "Conta", value: mlConnection ? (mlConnection.needs_reauth ? "Reconectar" : "Conectada") : "Desconectada" },
            { label: "Pedidos ML", value: mlOrders?.paging?.total ?? 0 },
            { label: "Anúncios ML", value: mlItems?.total ?? 0 },
            { label: "Vinculados", value: mlLinked?.length ?? 0 },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-2xl font-bold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Transferências pendentes */}
      {pendingTransfers.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Transferências Pendentes
          </h2>
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTransfers.slice(0, 5).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.order_number}</TableCell>
                      <TableCell><Badge variant="secondary">{t.status}</Badge></TableCell>
                      <TableCell className="text-center">{t.total_quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Últimas vendas */}
      {recentSales && recentSales.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Últimas Vendas
          </h2>
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono text-xs">{sale.sale_number}</TableCell>
                      <TableCell>{sale.customers?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{sale.payment_method}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(sale.total_value)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(sale.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Alertas ({alerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg p-3 ${
                    alert.type === "error" ? "bg-destructive/5 border border-destructive/20" : "bg-amber-50 border border-amber-200"
                  }`}
                >
                  <AlertTriangle className={`h-4 w-4 shrink-0 ${alert.type === "error" ? "text-destructive" : "text-amber-600"}`} />
                  <p className="text-sm">{alert.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Nenhum alerta no momento ✓</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PainelHub;
