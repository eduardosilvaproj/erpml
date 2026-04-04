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
  Bell,
  BellRing,
  Trash2,
  Upload,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  useSyncPrice,
  useSyncAllToML,
  useSyncMLCatalog,
  useMLAuthUrl,
  usePersistedMLOrders,
  useSyncMLOrders,
  useMLWebhookStatus,
  useRegisterMLWebhook,
  useUnregisterMLWebhook,
  useDisconnectML,
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
  const syncPrice = useSyncPrice();
  const syncAllToML = useSyncAllToML();
  const syncCatalog = useSyncMLCatalog();
  const syncOrders = useSyncMLOrders();
  const { data: authUrlData } = useMLAuthUrl();
  const { data: persistedOrders, isLoading: loadingPersisted } = usePersistedMLOrders();
  const { data: webhookStatus, isLoading: loadingWebhook } = useMLWebhookStatus(isConnected);
  const disconnectML = useDisconnectML();
  const registerWebhook = useRegisterMLWebhook();
  const unregisterWebhook = useUnregisterMLWebhook();

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

  const handleDisconnect = async () => {
    try {
      await disconnectML.mutateAsync();
      toast({ title: "Conta do Mercado Livre desconectada com sucesso!" });
    } catch (e: any) {
      toast({
        title: "Erro ao desconectar",
        description: e.message,
        variant: "destructive",
      });
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
                {persistedOrders?.length ?? orders?.paging?.total ?? 0}
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
            <TabsTrigger value="webhooks">
              <Bell className="h-4 w-4 mr-1" />
              Webhooks
            </TabsTrigger>
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
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Vendas do Mercado Livre</CardTitle>
                  <CardDescription>
                    Pedidos sincronizados e persistidos localmente
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const result = await syncOrders.mutateAsync();
                      toast({
                        title: "Pedidos sincronizados!",
                        description: `${result.inserted} novos, ${result.updated} atualizados de ${result.total_in_ml} total no ML.`,
                      });
                    } catch (e: any) {
                      toast({
                        title: "Erro ao sincronizar pedidos",
                        description: e.message,
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={syncOrders.isPending || connection?.needs_reauth}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${syncOrders.isPending ? "animate-spin" : ""}`} />
                  Sincronizar Pedidos
                </Button>
              </CardHeader>
              <CardContent>
                {loadingPersisted ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : persistedOrders?.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido ML</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Frete</TableHead>
                          <TableHead>Taxa ML</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Comprador</TableHead>
                          <TableHead>Itens</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {persistedOrders.map((order: any) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-xs">
                              #{order.ml_order_id}
                            </TableCell>
                            <TableCell>
                              {order.date_created
                                ? new Date(order.date_created).toLocaleDateString("pt-BR")
                                : "—"}
                            </TableCell>
                            <TableCell className="font-medium">
                              R$ {Number(order.total_amount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              R$ {Number(order.shipping_cost || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              R$ {Number(order.marketplace_fee || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  order.status === "paid"
                                    ? "default"
                                    : order.status === "cancelled"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {order.ml_buyer_nickname || "—"}
                            </TableCell>
                            <TableCell>
                              {order.ml_order_items?.length ?? 0}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>Nenhum pedido sincronizado ainda</p>
                    <p className="text-xs mt-1">Clique em "Sincronizar Pedidos" para importar do ML</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vinculados Tab */}
          <TabsContent value="linked">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Produtos Vinculados</CardTitle>
                  <CardDescription>
                    Produtos locais vinculados a anúncios ML — sincronize preço e estoque para o Mercado Livre
                  </CardDescription>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      const result = await syncAllToML.mutateAsync();
                      toast({
                        title: "Sincronização ERP → ML concluída!",
                        description: `${result.synced} produto(s) atualizados${result.errors ? `, ${result.errors} erro(s)` : ""}.`,
                      });
                    } catch (e: any) {
                      toast({
                        title: "Erro na sincronização em massa",
                        description: e.message,
                        variant: "destructive",
                      });
                    }
                  }}
                  disabled={syncAllToML.isPending || !linked?.length || connection?.needs_reauth}
                >
                  {syncAllToML.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Enviar Tudo → ML
                </Button>
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
                          <TableHead>Preço ERP</TableHead>
                          <TableHead>Preço ML</TableHead>
                          <TableHead>Estoque ERP</TableHead>
                          <TableHead>Estoque ML</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linked.map((lp: any) => {
                          const erpPrice = lp.products?.price ?? 0;
                          const mlPrice = lp.ml_price ?? 0;
                          const erpStock = lp.products?.stock_physical ?? 0;
                          const mlStock = lp.ml_available_quantity ?? 0;
                          const priceDiff = Math.abs(erpPrice - mlPrice) > 0.01;
                          const stockDiff = erpStock !== mlStock;

                          return (
                            <TableRow key={lp.id}>
                              <TableCell className="font-medium">
                                {lp.products?.name || "—"}
                              </TableCell>
                              <TableCell>{lp.products?.sku || "—"}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {lp.ml_item_id}
                              </TableCell>
                              <TableCell className={priceDiff ? "font-semibold text-primary" : ""}>
                                R$ {erpPrice.toFixed(2)}
                              </TableCell>
                              <TableCell className={priceDiff ? "text-muted-foreground" : ""}>
                                R$ {mlPrice.toFixed(2)}
                                {priceDiff && (
                                  <Badge variant="outline" className="ml-1 text-[10px]">
                                    diferente
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className={stockDiff ? "font-semibold text-primary" : ""}>
                                {erpStock}
                              </TableCell>
                              <TableCell className={stockDiff ? "text-muted-foreground" : ""}>
                                {mlStock}
                                {stockDiff && (
                                  <Badge variant="outline" className="ml-1 text-[10px]">
                                    diferente
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={lp.sync_status === "synced" ? "default" : "secondary"}
                                >
                                  {lp.sync_status || "pending"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    title="Enviar estoque ERP → ML"
                                    onClick={() => handleSyncStock(lp.ml_item_id, erpStock)}
                                    disabled={syncStock.isPending || !stockDiff}
                                  >
                                    <Package className="h-3 w-3 mr-1" />
                                    Estoque
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    title="Enviar preço ERP → ML"
                                    onClick={async () => {
                                      try {
                                        await syncPrice.mutateAsync({
                                          itemId: lp.ml_item_id,
                                          price: erpPrice,
                                        });
                                        toast({ title: "Preço sincronizado no ML!" });
                                      } catch (e: any) {
                                        toast({
                                          title: "Erro ao sincronizar preço",
                                          description: e.message,
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    disabled={syncPrice.isPending || !priceDiff}
                                  >
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    Preço
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
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

          {/* Webhooks Tab */}
          <TabsContent value="webhooks">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BellRing className="h-5 w-5" />
                  Notificações em Tempo Real
                </CardTitle>
                <CardDescription>
                  Configure webhooks para receber atualizações automáticas de pedidos, anúncios e perguntas do Mercado Livre.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={async () => {
                      try {
                        const result = await registerWebhook.mutateAsync();
                        toast({
                          title: "Webhooks registrados!",
                          description: `${result.results?.length ?? 0} tópico(s) configurado(s) para notificação em tempo real.`,
                        });
                      } catch (e: any) {
                        toast({
                          title: "Erro ao registrar webhooks",
                          description: e.message,
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={registerWebhook.isPending || connection?.needs_reauth}
                  >
                    {registerWebhook.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <BellRing className="mr-2 h-4 w-4" />
                    )}
                    Ativar Webhooks
                  </Button>
                </div>

                {loadingWebhook ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : Array.isArray(webhookStatus) && webhookStatus.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tópico</TableHead>
                          <TableHead>URL de Callback</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {webhookStatus.map((wh: any, idx: number) => (
                          <TableRow key={wh.id ?? idx}>
                            <TableCell>
                              <Badge variant="secondary">{wh.topic ?? "—"}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                              {wh.callback_url ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="default" className="bg-accent text-accent-foreground">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Ativo
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await unregisterWebhook.mutateAsync(String(wh.id));
                                    toast({ title: `Webhook "${wh.topic}" removido.` });
                                  } catch (e: any) {
                                    toast({
                                      title: "Erro ao remover webhook",
                                      description: e.message,
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                disabled={unregisterWebhook.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-2">
                    <Bell className="h-10 w-10 mx-auto text-muted-foreground opacity-30" />
                    <p className="text-muted-foreground">
                      Nenhum webhook ativo. Ative para receber notificações em tempo real.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Com webhooks ativos, pedidos e alterações de anúncios são sincronizados automaticamente.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
