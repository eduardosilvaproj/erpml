import { useState, useEffect } from "react";
import {
  ShoppingBag,
  Link2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Package,
  DollarSign,
  Loader2,
  ExternalLink,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  useMLConnection,
  useMLItems,
  useMLOrders,
  useMLLinkedProducts,
  useSyncStock,
  useSyncMLCatalog,
  useMLAuthUrl,
} from "@/hooks/useMLData";
import { useSearchParams } from "react-router-dom";

export default function IntegracaoML() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { data: connection, isLoading: loadingConn } = useMLConnection();
  const isConnected = !!connection;
  const { data: items, isLoading: loadingItems } = useMLItems(isConnected);
  const { data: orders, isLoading: loadingOrders } = useMLOrders(isConnected);
  const { data: linked, isLoading: loadingLinked } = useMLLinkedProducts();
  const syncStock = useSyncStock();
  const syncCatalog = useSyncMLCatalog();
  const { data: authUrlData } = useMLAuthUrl();

  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      toast({ title: "Conta ML conectada com sucesso!" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnect = () => {
    if (authUrlData?.url) {
      const isEmbedded = window.self !== window.top;

      if (isEmbedded) {
        const popup = window.open(
          authUrlData.url,
          "_blank",
          "noopener,noreferrer"
        );

        if (popup) {
          popup.opener = null;
          return;
        }
      }

      window.location.assign(authUrlData.url);
    }
  };

  const handleSyncStock = async (itemId: string, quantity: number) => {
    try {
      await syncStock.mutateAsync({ itemId, quantity });
      toast({ title: "Estoque sincronizado!" });
    } catch (e: any) {
      toast({
        title: "Erro ao sincronizar",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const handleSyncCatalog = async () => {
    try {
      const result = await syncCatalog.mutateAsync();
      toast({
        title: "Catálogo sincronizado!",
        description: `${result.linked_products} produto(s) vinculado(s) e ${result.unmatched_items} anúncio(s) sem correspondência automática.`,
      });
    } catch (e: any) {
      toast({
        title: "Erro ao sincronizar catálogo",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  if (loadingConn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Integração Mercado Livre
          </h1>
          <p className="text-muted-foreground">
            Conecte e sincronize com sua conta ML
          </p>
        </div>
        {isConnected ? (
          <div className="flex items-center gap-2">
            <Badge
              variant="default"
              className="bg-accent text-accent-foreground gap-1 px-3 py-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Conectado: {connection.seller_nickname}
            </Badge>
            <Button
              variant="outline"
              onClick={handleSyncCatalog}
              disabled={syncCatalog.isPending || connection?.needs_reauth}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncCatalog.isPending ? "animate-spin" : ""}`} />
              Sincronizar catálogo
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={!authUrlData?.url}>
            <Link2 className="mr-2 h-4 w-4" />
            Conectar Conta ML
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pedidos ML</p>
              <p className="text-2xl font-bold">
                {orders?.paging?.total ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Anúncios Ativos</p>
              <p className="text-2xl font-bold">{items?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Produtos Vinculados
              </p>
              <p className="text-2xl font-bold">{linked?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {connection?.needs_reauth && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">Reconecte sua conta do Mercado Livre</p>
              <p className="text-sm text-muted-foreground">
                A conexão expirou sem token de renovação. Reconecte para voltar a carregar anúncios, pedidos e vínculos no dashboard.
              </p>
            </div>
            <Button onClick={handleConnect} disabled={!authUrlData?.url}>
              <Link2 className="mr-2 h-4 w-4" />
              Reconectar conta
            </Button>
          </CardContent>
        </Card>
      )}

      {!isConnected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <AlertTriangle className="mb-4 h-12 w-12 opacity-30" />
            <p className="text-lg font-medium">Conta não conectada</p>
            <p className="text-sm">
              Conecte sua conta do Mercado Livre para ver anúncios, vendas e
              sincronizar estoque
            </p>
            <Button className="mt-4" onClick={handleConnect} disabled={!authUrlData?.url}>
              <Link2 className="mr-2 h-4 w-4" />
              Conectar Agora
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items">Anúncios</TabsTrigger>
            <TabsTrigger value="orders">Vendas</TabsTrigger>
            <TabsTrigger value="linked">Vinculados</TabsTrigger>
          </TabsList>

          {/* Anúncios Tab */}
          <TabsContent value="items">
            <Card>
              <CardHeader>
                <CardTitle>Anúncios no Mercado Livre</CardTitle>
                <CardDescription>
                  Seus anúncios ativos na plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingItems ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : items?.items?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Preço</TableHead>
                          <TableHead>Qtd. Disponível</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Link</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium max-w-[300px] truncate">
                              {item.title}
                            </TableCell>
                            <TableCell>
                              R$ {Number(item.price).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {item.available_quantity}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <a
                                href={item.permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                              </a>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum anúncio encontrado
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vendas Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Vendas Recentes</CardTitle>
                <CardDescription>
                  Últimas vendas no Mercado Livre
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingOrders ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : orders?.results?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Comprador</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.results.map((order: any) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">
                              #{order.id}
                            </TableCell>
                            <TableCell>
                              {new Date(
                                order.date_created
                              ).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              R${" "}
                              {Number(order.total_amount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  order.status === "paid"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {order.buyer?.nickname || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma venda encontrada
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vinculados Tab */}
          <TabsContent value="linked">
            <Card>
              <CardHeader>
                <CardTitle>Produtos Vinculados</CardTitle>
                <CardDescription>
                  Produtos locais vinculados a anúncios ML
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLinked ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : linked?.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto Local</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>ID ML</TableHead>
                          <TableHead>Título ML</TableHead>
                          <TableHead>Estoque Físico</TableHead>
                          <TableHead>Estoque ML</TableHead>
                          <TableHead>Status Sync</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linked.map((lp: any) => (
                          <TableRow key={lp.id}>
                            <TableCell className="font-medium">
                              {lp.products?.name || "—"}
                            </TableCell>
                            <TableCell>{lp.products?.sku || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {lp.ml_item_id}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {lp.ml_title || "—"}
                            </TableCell>
                            <TableCell>
                              {lp.products?.stock_physical ?? 0}
                            </TableCell>
                            <TableCell>
                              {lp.ml_available_quantity ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  lp.sync_status === "synced"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {lp.sync_status || "pending"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleSyncStock(
                                    lp.ml_item_id,
                                    lp.products?.stock_physical ?? 0
                                  )
                                }
                                disabled={syncStock.isPending}
                              >
                                <RefreshCw
                                  className={`h-3 w-3 mr-1 ${
                                    syncStock.isPending ? "animate-spin" : ""
                                  }`}
                                />
                                Sync
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum produto vinculado ainda
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
