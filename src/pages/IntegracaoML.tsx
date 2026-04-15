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
  Store,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

const platforms = [
  { id: "mercadolivre", name: "Mercado Livre", icon: "🟡", connected: true },
  { id: "shopee", name: "Shopee", icon: "🟠", connected: false },
  { id: "amazon", name: "Amazon", icon: "📦", connected: false },
  { id: "shopify", name: "Shopify", icon: "🟢", connected: false },
];

function ComingSoonPlatform({ name }: { name: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Store className="mb-4 h-12 w-12 opacity-30" />
        <p className="text-lg font-medium">Integração {name}</p>
        <p className="text-sm">Em breve — estamos trabalhando nesta integração</p>
        <Badge variant="outline" className="mt-4">Em desenvolvimento</Badge>
      </CardContent>
    </Card>
  );
}

export default function IntegracaoML() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [activePlatform, setActivePlatform] = useState("mercadolivre");
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
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        description: `${result.linked_products} produto(s) vinculado(s) e ${result.unmatched_items} anúncio(s) sem correspondência automática.`,
      });
    } catch (e: any) {
      toast({ title: "Erro ao sincronizar catálogo", description: e.message, variant: "destructive" });
    }
  };

  if (loadingConn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Determine ML connection status for platform tabs
  const mlConnected = isConnected && !connection?.needs_reauth;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-muted-foreground">Conecte seus marketplaces e sincronize vendas, estoque e anúncios</p>
      </div>

      {/* Platform tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {platforms.map((p) => {
          const isActive = activePlatform === p.id;
          const isConn = p.id === "mercadolivre" ? mlConnected : false;
          return (
            <button
              key={p.id}
              onClick={() => setActivePlatform(p.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap ${
                isActive
                  ? "border-primary/50 bg-primary/5 text-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30"
              }`}
            >
              <span className="text-lg">{p.icon}</span>
              <span className="font-medium text-sm">{p.name}</span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${
                  isConn
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-muted/30 text-muted-foreground border-border"
                }`}
              >
                {isConn ? "Conectado" : "Desconectado"}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Non-ML platforms */}
      {activePlatform !== "mercadolivre" && (
        <ComingSoonPlatform name={platforms.find((p) => p.id === activePlatform)?.name || ""} />
      )}

      {/* Mercado Livre content */}
      {activePlatform === "mercadolivre" && (
        <>
          {/* Connection status panel */}
          {isConnected && (
            <Card>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${mlConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                  <div>
                    <p className="font-medium text-sm">
                      {mlConnected ? "Conexão ativa" : "Reconexão necessária"} — {connection.seller_nickname}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Última sinc.: {connection.updated_at ? new Date(connection.updated_at).toLocaleString("pt-BR") : "—"}
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
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={disconnectML.isPending}>
                        {disconnectML.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Unplug className="h-3 w-3 mr-1" />}
                        Desconectar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Desconectar Mercado Livre?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso removerá a conexão com <strong>{connection.seller_nickname}</strong> e todos os vínculos. Pedidos sincronizados serão mantidos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Desconectar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )}

          {connection?.needs_reauth && (
            <Card className="border-amber-500/30">
              <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">Reconecte sua conta do Mercado Livre</p>
                  <p className="text-sm text-muted-foreground">
                    A conexão expirou. Reconecte para voltar a sincronizar.
                  </p>
                </div>
                <Button onClick={handleConnect} disabled={!authUrlData?.url}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Reconectar conta
                </Button>
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

          {!isConnected ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertTriangle className="mb-4 h-12 w-12 opacity-30" />
                <p className="text-lg font-medium">Conta não conectada</p>
                <p className="text-sm">Conecte sua conta do Mercado Livre para ver anúncios, vendas e sincronizar estoque</p>
                <Button className="mt-4" onClick={handleConnect} disabled={!authUrlData?.url}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Conectar Agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Unlinked products alert */}
              {items?.total > 0 && linked && items.total > linked.length && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {(items.total - (linked?.length || 0))} produto(s) não vinculado(s)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Existem anúncios no ML sem correspondência com produtos do ERP
                        </p>
                      </div>
                    </div>
                    <Button size="sm" onClick={handleSyncCatalog} disabled={syncCatalog.isPending}>
                      {syncCatalog.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ArrowRightLeft className="h-3 w-3 mr-1" />}
                      Vincular produtos automaticamente
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Tabs defaultValue="orders">
                <TabsList>
                  <TabsTrigger value="orders">Pedidos Recentes</TabsTrigger>
                  <TabsTrigger value="items">Anúncios Ativos</TabsTrigger>
                  <TabsTrigger value="linked">Vinculados</TabsTrigger>
                  <TabsTrigger value="webhooks"><Bell className="h-4 w-4 mr-1" /> Webhooks</TabsTrigger>
                </TabsList>

                {/* Pedidos Tab */}
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
                        <RefreshCw className={`h-3 w-3 mr-1 ${syncOrders.isPending ? "animate-spin" : ""}`} />
                        Sincronizar Pedidos
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
                                  <TableCell className="font-mono text-xs">#{order.ml_order_id}</TableCell>
                                  <TableCell>{order.date_created ? new Date(order.date_created).toLocaleDateString("pt-BR") : "—"}</TableCell>
                                  <TableCell className="font-medium">R$ {Number(order.total_amount).toFixed(2)}</TableCell>
                                  <TableCell>R$ {Number(order.shipping_cost || 0).toFixed(2)}</TableCell>
                                  <TableCell>R$ {Number(order.marketplace_fee || 0).toFixed(2)}</TableCell>
                                  <TableCell>
                                    <Badge variant={order.status === "paid" ? "default" : order.status === "cancelled" ? "destructive" : "secondary"}>
                                      {order.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{order.ml_buyer_nickname || "—"}</TableCell>
                                  <TableCell>{order.ml_order_items?.length ?? 0}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          <p>Nenhum pedido sincronizado ainda</p>
                          <p className="text-xs mt-1">Clique em "Sincronizar Pedidos" para importar</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Anúncios Tab */}
                <TabsContent value="items">
                  <Card>
                    <CardHeader>
                      <CardTitle>Anúncios Ativos</CardTitle>
                      <CardDescription>Seus anúncios ativos no Mercado Livre</CardDescription>
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
                                  <TableCell>
                                    <Badge variant={item.status === "active" ? "default" : "secondary"}>{item.status}</Badge>
                                  </TableCell>
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

                {/* Vinculados Tab */}
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
                                    <TableCell>
                                      <Badge variant={lp.sync_status === "synced" ? "default" : "secondary"}>{lp.sync_status || "pending"}</Badge>
                                    </TableCell>
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
                        <p className="text-center text-muted-foreground py-8">Nenhum produto vinculado ainda</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Webhooks Tab */}
                <TabsContent value="webhooks">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" /> Notificações em Tempo Real</CardTitle>
                      <CardDescription>Webhooks para atualizações automáticas de pedidos, anúncios e perguntas.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <Button onClick={async () => {
                        try {
                          const result = await registerWebhook.mutateAsync();
                          toast({ title: "Webhooks registrados!", description: `${result.results?.length ?? 0} tópico(s) configurado(s).` });
                        } catch (e: any) {
                          toast({ title: "Erro", description: e.message, variant: "destructive" });
                        }
                      }} disabled={registerWebhook.isPending || connection?.needs_reauth}>
                        {registerWebhook.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
                        Ativar Webhooks
                      </Button>
                      {loadingWebhook ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                      ) : Array.isArray(webhookStatus) && webhookStatus.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tópico</TableHead>
                              <TableHead>URL</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {webhookStatus.map((wh: any, idx: number) => (
                              <TableRow key={wh.id ?? idx}>
                                <TableCell><Badge variant="secondary">{wh.topic ?? "—"}</Badge></TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{wh.callback_url ?? "—"}</TableCell>
                                <TableCell>
                                  <Badge variant="default" className="bg-accent text-accent-foreground">
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" onClick={async () => {
                                    try {
                                      await unregisterWebhook.mutateAsync(String(wh.id));
                                      toast({ title: `Webhook "${wh.topic}" removido.` });
                                    } catch (e: any) {
                                      toast({ title: "Erro", description: e.message, variant: "destructive" });
                                    }
                                  }} disabled={unregisterWebhook.isPending}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-8 space-y-2">
                          <Bell className="h-10 w-10 mx-auto text-muted-foreground opacity-30" />
                          <p className="text-muted-foreground">Nenhum webhook ativo.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Collapsible Settings */}
              <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2"><Settings className="h-4 w-4" /> Configurações da Integração</span>
                    <span className="text-xs text-muted-foreground">{settingsOpen ? "▲" : "▼"}</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Sync interval */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Frequência de Sincronização</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Select defaultValue="30min">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15min">A cada 15 minutos</SelectItem>
                            <SelectItem value="30min">A cada 30 minutos</SelectItem>
                            <SelectItem value="1h">A cada 1 hora</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>

                    {/* Toggles */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Sincronização Automática</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="s-stock" className="text-sm">Atualizar estoque automaticamente</Label>
                            <p className="text-xs text-muted-foreground">ERP → ML quando houver alteração</p>
                          </div>
                          <Switch id="s-stock" checked={mlSettings?.auto_sync_stock ?? true} disabled={updateSettings.isPending || loadingSettings}
                            onCheckedChange={(c) => updateSettings.mutate({ auto_sync_stock: c })} />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="s-price" className="text-sm">Atualizar preços automaticamente</Label>
                            <p className="text-xs text-muted-foreground">Preços do ERP sincronizados no ML</p>
                          </div>
                          <Switch id="s-price" checked={mlSettings?.auto_sync_price ?? true} disabled={updateSettings.isPending || loadingSettings}
                            onCheckedChange={(c) => updateSettings.mutate({ auto_sync_price: c })} />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="s-orders" className="text-sm">Importar pedidos automaticamente</Label>
                            <p className="text-xs text-muted-foreground">Webhook em tempo real</p>
                          </div>
                          <Switch id="s-orders" checked={mlSettings?.auto_sync_orders ?? true} disabled={updateSettings.isPending || loadingSettings}
                            onCheckedChange={(c) => updateSettings.mutate({ auto_sync_orders: c })} />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="s-notify" className="text-sm">Notificar quando pedido chegar</Label>
                            <p className="text-xs text-muted-foreground">Alerta ao receber novo pedido</p>
                          </div>
                          <Switch id="s-notify" checked={mlSettings?.auto_suggest_answers ?? false} disabled={updateSettings.isPending || loadingSettings}
                            onCheckedChange={(c) => updateSettings.mutate({ auto_suggest_answers: c })} />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Account info */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Informações da Conta</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Vendedor</span><span className="font-medium">{connection?.seller_nickname || "—"}</span></div>
                        <Separator />
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">ID ML</span><span className="font-mono">{connection?.ml_user_id || "—"}</span></div>
                        <Separator />
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span>
                          <Badge variant={connection?.is_active ? "default" : "destructive"}>{connection?.is_active ? "Ativa" : "Inativa"}</Badge>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Token expira</span>
                          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                            {connection?.token_expires_at ? new Date(connection.token_expires_at).toLocaleString("pt-BR") : "—"}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Refresh Token</span>
                          <Badge variant={connection?.has_refresh_token ? "default" : "secondary"}>
                            <Shield className="h-3 w-3 mr-1" />{connection?.has_refresh_token ? "Disponível" : "Ausente"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Integration summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Resumo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3 grid-cols-2">
                          <div className="rounded-lg border p-3 text-center">
                            <p className="text-2xl font-bold text-primary">{linked?.length ?? 0}</p>
                            <p className="text-xs text-muted-foreground">Vinculados</p>
                          </div>
                          <div className="rounded-lg border p-3 text-center">
                            <p className="text-2xl font-bold text-primary">{items?.total ?? 0}</p>
                            <p className="text-xs text-muted-foreground">Anúncios</p>
                          </div>
                          <div className="rounded-lg border p-3 text-center">
                            <p className="text-2xl font-bold text-primary">{persistedOrders?.length ?? 0}</p>
                            <p className="text-xs text-muted-foreground">Pedidos</p>
                          </div>
                          <div className="rounded-lg border p-3 text-center">
                            <p className="text-2xl font-bold text-primary">{Array.isArray(webhookStatus) ? webhookStatus.length : 0}</p>
                            <p className="text-xs text-muted-foreground">Webhooks</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </>
      )}
    </div>
  );
}
