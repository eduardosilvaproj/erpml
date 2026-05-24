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
  Settings,
  Clock,
  User,
  CalendarDays,
  Shield,
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useMLSettings, useUpdateMLSettings } from "@/hooks/useMLSettings";
import { useSearchParams } from "react-router-dom";

function SettingsCard({ mlSettings, loadingSettings, updateSettings }: { mlSettings: any; loadingSettings: boolean; updateSettings: any }) {
  const [autoSync, setAutoSync] = useState(mlSettings?.auto_sync_stock ?? true);

  return (
    <Card className="bg-muted/20 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-5 w-5" /> Configurações
        </CardTitle>
        <CardDescription>Preferências de sincronização e notificações</CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {/* Sync auto */}
        <div className="flex items-center justify-between py-4">
          <div className="space-y-0.5 flex-1 mr-4">
            <Label className="text-sm font-medium">Sincronização automática</Label>
            <p className="text-xs text-muted-foreground">Atualizar dados periodicamente</p>
          </div>
          <div className="flex items-center gap-3">
            {autoSync && (
              <Select defaultValue="30min">
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15min">15 min</SelectItem>
                  <SelectItem value="30min">30 min</SelectItem>
                  <SelectItem value="1h">1 hora</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Switch checked={autoSync} onCheckedChange={setAutoSync} />
          </div>
        </div>

        <Separator />

        {/* Stock */}
        <div className="flex items-center justify-between py-4">
          <div className="space-y-0.5">
            <Label htmlFor="cfg-stock" className="text-sm font-medium">Atualizar estoque</Label>
            <p className="text-xs text-muted-foreground">Baixar estoque ao receber pedido ML</p>
          </div>
          <Switch id="cfg-stock" checked={mlSettings?.auto_sync_stock ?? true} disabled={updateSettings.isPending || loadingSettings}
            onCheckedChange={(c) => updateSettings.mutate({ auto_sync_stock: c })} />
        </div>

        <Separator />

        {/* Price */}
        <div className="flex items-center justify-between py-4">
          <div className="space-y-0.5">
            <Label htmlFor="cfg-price" className="text-sm font-medium">Sincronizar preços</Label>
            <p className="text-xs text-muted-foreground">Manter preços iguais ao sistema</p>
          </div>
          <Switch id="cfg-price" checked={mlSettings?.auto_sync_price ?? true} disabled={updateSettings.isPending || loadingSettings}
            onCheckedChange={(c) => updateSettings.mutate({ auto_sync_price: c })} />
        </div>

        <Separator />

        {/* Notify */}
        <div className="flex items-center justify-between py-4">
          <div className="space-y-0.5">
            <Label htmlFor="cfg-notify" className="text-sm font-medium">Notificar novos pedidos</Label>
            <p className="text-xs text-muted-foreground">Alerta ao receber pedido no ML</p>
          </div>
          <Switch id="cfg-notify" checked={mlSettings?.auto_sync_orders ?? true} disabled={updateSettings.isPending || loadingSettings}
            onCheckedChange={(c) => updateSettings.mutate({ auto_sync_orders: c })} />
        </div>
      </CardContent>
    </Card>
  );
}

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
  const { data: mlSettings, isLoading: loadingSettings } = useMLSettings();
  const updateSettings = useUpdateMLSettings();

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
        const popup = window.open(authUrlData.url, "_blank", "noopener,noreferrer");
        if (popup) { popup.opener = null; return; }
      }
      window.location.assign(authUrlData.url);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectML.mutateAsync();
      toast({ title: "Conta do Mercado Livre desconectada com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao desconectar", description: e.message, variant: "destructive" });
    }
  };

  const handleSyncStock = async (itemId: string, quantity: number) => {
    try {
      await syncStock.mutateAsync({ itemId, quantity });
      toast({ title: "Estoque sincronizado!" });
    } catch (e: any) {
      toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
    }
  };

  const handleSyncCatalog = async () => {
    try {
      const result = await syncCatalog.mutateAsync();
      toast({
        title: "Catálogo sincronizado!",
        description: `${result.linked_products} vinculado(s), ${result.unmatched_items} sem correspondência.`,
      });
    } catch (e: any) {
      toast({ title: "Erro ao sincronizar catálogo", description: e.message, variant: "destructive" });
    }
  };

  const mlConnected = isConnected && !connection?.needs_reauth;

  if (loadingConn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integração Mercado Livre</h1>
          <p className="text-muted-foreground">Conecte e sincronize com sua conta ML</p>
        </div>
        {!isConnected && (
          <Button onClick={handleConnect} disabled={!authUrlData?.url}>
            <Link2 className="mr-2 h-4 w-4" /> Conectar Conta ML
          </Button>
        )}
      </div>

      {/* Connection status card */}
      {isConnected && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full shrink-0 ${mlConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={mlConnected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}>
                      {mlConnected ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</> : "Reconexão necessária"}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium mt-1">
                    Conta: <span className="text-primary">{connection.seller_nickname}</span>
                    <span className="text-muted-foreground ml-2">• ID: {connection.ml_user_id}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Última sincronização: {(connection as any).updated_at ? new Date((connection as any).updated_at).toLocaleString("pt-BR") : "agora"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSyncCatalog} disabled={syncCatalog.isPending || connection?.needs_reauth}>
                  <RefreshCw className={`mr-1 h-3 w-3 ${syncCatalog.isPending ? "animate-spin" : ""}`} />
                  Sincronizar agora
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={disconnectML.isPending}>
                      {disconnectML.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Unplug className="h-3 w-3 mr-1" />}
                      Desconectar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desconectar Mercado Livre?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Remove a conexão com <strong>{connection.seller_nickname}</strong> e vínculos. Pedidos sincronizados serão mantidos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Desconectar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reauth banner */}
      {connection?.needs_reauth && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">Reconecte sua conta</p>
              <p className="text-sm text-muted-foreground">A conexão expirou. Reconecte para voltar a sincronizar.</p>
            </div>
            <Button onClick={handleConnect} disabled={!authUrlData?.url}><Link2 className="mr-2 h-4 w-4" /> Reconectar</Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2"><ShoppingBag className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Pedidos ML</p>
              <p className="text-2xl font-bold">{persistedOrders?.length ?? orders?.paging?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2"><Package className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Anúncios Ativos</p>
              <p className="text-2xl font-bold">{items?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2"><ArrowRightLeft className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Produtos Vinculados</p>
              <p className="text-2xl font-bold">{linked?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Not connected state */}
      {!isConnected && (
        <>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertTriangle className="mb-4 h-12 w-12 opacity-30" />
              <p className="text-lg font-medium">Conta não conectada</p>
              <p className="text-sm">Conecte sua conta do Mercado Livre para sincronizar</p>
              <Button className="mt-4" onClick={handleConnect} disabled={!authUrlData?.url}>
                <Link2 className="mr-2 h-4 w-4" /> Conectar Agora
              </Button>
            </CardContent>
          </Card>

          {/* Settings card (always visible) */}
          <SettingsCard
            mlSettings={mlSettings}
            loadingSettings={loadingSettings}
            updateSettings={updateSettings}
          />
        </>
      )}

      {/* Connected content */}
      {isConnected && (
        <>
          {/* Unlinked products alert */}
          {items?.total > 0 && linked && items.total > linked.length && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{items.total - (linked?.length || 0)} produto(s) não vinculado(s) ao ML</p>
                    <p className="text-xs text-muted-foreground">Anúncios no ML sem correspondência com produtos do ERP</p>
                  </div>
                </div>
                <Button size="sm" onClick={handleSyncCatalog} disabled={syncCatalog.isPending}>
                  {syncCatalog.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowRightLeft className="h-3 w-3 mr-1" />}
                  Vincular automaticamente
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tabs: Orders, Listings, Linked */}
          <Tabs defaultValue="orders">
            <TabsList>
              <TabsTrigger value="orders">Pedidos Recentes</TabsTrigger>
              <TabsTrigger value="items">Anúncios Ativos</TabsTrigger>
              <TabsTrigger value="linked">Vinculados</TabsTrigger>
            </TabsList>

            <TabsContent value="orders">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Pedidos Recentes</CardTitle>
                    <CardDescription>Pedidos sincronizados do Mercado Livre</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      const result = await syncOrders.mutateAsync();
                      toast({ title: "Pedidos sincronizados!", description: `${result.inserted} novos, ${result.updated} atualizados.` });
                    } catch (e: any) {
                      toast({ title: "Erro", description: e.message, variant: "destructive" });
                    }
                  }} disabled={syncOrders.isPending || connection?.needs_reauth}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${syncOrders.isPending ? "animate-spin" : ""}`} /> Sincronizar
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingPersisted ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : persistedOrders?.length ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Frete</TableHead>
                            <TableHead>Taxa ML</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Comprador</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {persistedOrders.map((order: any) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono text-xs">#{order.ml_order_id}</TableCell>
                              <TableCell>{order.date_created ? new Date(order.date_created).toLocaleDateString("pt-BR") : "—"}</TableCell>
                              <TableCell className="font-medium">R$ {Number(order.total_amount).toFixed(2)}</TableCell>
                              <TableCell>R$ {Number(order.shipping_cost || 0).toFixed(2)}</TableCell>
                              <TableCell>R$ {Number(order.marketplace_fee || 0).toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge variant={order.status === "paid" ? "default" : order.status === "cancelled" ? "destructive" : "secondary"}>{order.status}</Badge>
                              </TableCell>
                              <TableCell>{order.ml_buyer_nickname || "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <p>Nenhum pedido sincronizado</p>
                      <p className="text-xs mt-1">Clique em "Sincronizar" para importar</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="items">
              <Card>
                <CardHeader>
                  <CardTitle>Anúncios Ativos</CardTitle>
                  <CardDescription>Seus anúncios no Mercado Livre</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingItems ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : items?.items?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Preço</TableHead>
                            <TableHead>Qtd.</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Link</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.items.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium max-w-[300px] truncate">{item.title}</TableCell>
                              <TableCell>R$ {Number(item.price).toFixed(2)}</TableCell>
                              <TableCell>{item.available_quantity}</TableCell>
                              <TableCell><Badge variant={item.status === "active" ? "default" : "secondary"}>{item.status}</Badge></TableCell>
                              <TableCell>
                                <a href={item.permalink} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                </a>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhum anúncio encontrado</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="linked">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Produtos Vinculados</CardTitle>
                    <CardDescription>Sincronize preço e estoque para o ML</CardDescription>
                  </div>
                  <Button onClick={async () => {
                    try {
                      const result = await syncAllToML.mutateAsync();
                      toast({ title: "Sincronização concluída!", description: `${result.synced} produto(s) atualizados.` });
                    } catch (e: any) {
                      toast({ title: "Erro", description: e.message, variant: "destructive" });
                    }
                  }} disabled={syncAllToML.isPending || !linked?.length || connection?.needs_reauth}>
                    {syncAllToML.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Enviar Tudo → ML
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingLinked ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : linked?.length ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>ID ML</TableHead>
                            <TableHead>Preço ERP</TableHead>
                            <TableHead>Preço ML</TableHead>
                            <TableHead>Est. ERP</TableHead>
                            <TableHead>Est. ML</TableHead>
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
                                <TableCell className="font-medium">{lp.products?.name || "—"}</TableCell>
                                <TableCell>{lp.products?.sku || "—"}</TableCell>
                                <TableCell className="font-mono text-xs">{lp.ml_item_id}</TableCell>
                                <TableCell className={priceDiff ? "font-semibold text-primary" : ""}>R$ {erpPrice.toFixed(2)}</TableCell>
                                <TableCell className={priceDiff ? "text-muted-foreground" : ""}>
                                  R$ {mlPrice.toFixed(2)}
                                  {priceDiff && <Badge variant="outline" className="ml-1 text-[10px]">diferente</Badge>}
                                </TableCell>
                                <TableCell className={stockDiff ? "font-semibold text-primary" : ""}>{erpStock}</TableCell>
                                <TableCell className={stockDiff ? "text-muted-foreground" : ""}>
                                  {mlStock}
                                  {stockDiff && <Badge variant="outline" className="ml-1 text-[10px]">diferente</Badge>}
                                </TableCell>
                                <TableCell><Badge variant={lp.sync_status === "synced" ? "default" : "secondary"}>{lp.sync_status || "pending"}</Badge></TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="outline" onClick={() => handleSyncStock(lp.ml_item_id, erpStock)} disabled={syncStock.isPending || !stockDiff}>
                                      <Package className="h-3 w-3 mr-1" /> Estoque
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={async () => {
                                      try {
                                        await syncPrice.mutateAsync({ itemId: lp.ml_item_id, price: erpPrice });
                                        toast({ title: "Preço sincronizado!" });
                                      } catch (e: any) {
                                        toast({ title: "Erro", description: e.message, variant: "destructive" });
                                      }
                                    }} disabled={syncPrice.isPending || !priceDiff}>
                                      <DollarSign className="h-3 w-3 mr-1" /> Preço
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
                    <p className="text-center text-muted-foreground py-8">Nenhum produto vinculado</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Settings card */}
          <SettingsCard
            mlSettings={mlSettings}
            loadingSettings={loadingSettings}
            updateSettings={updateSettings}
          />
        </>
      )}
    </div>
  );
}
