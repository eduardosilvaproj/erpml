import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowRight, ScanBarcode, Package, Truck, Loader2, Plus, Minus,
  Trash2, Check, ChevronRight, Clock, CheckCircle, AlertTriangle, Boxes
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useTransferOrders, useCreateTransferOrder, useUpdateTransferStatus,
  type TransferItem, type TransferOrder
} from "@/hooks/useTransferData";
import { useKits, type Kit } from "@/hooks/useKitData";
import { BarcodeScanner } from "@/components/BarcodeScanner";

const MovimentacaoFull = () => {
  const { toast } = useToast();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [usedKits, setUsedKits] = useState<string[]>([]);
  const [scanBuffer, setScanBuffer] = useState("");
  const [lastScan, setLastScan] = useState<{ success: boolean; message: string } | null>(null);

  const { data: orders } = useTransferOrders();
  const { data: kits } = useKits();
  const createOrder = useCreateTransferOrder();
  const updateStatus = useUpdateTransferStatus();

  // Auto-focus scan input
  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  const addOrIncrementItem = (
    currentItems: TransferItem[],
    product: { id: string; name: string; sku: string; barcode: string | null; stock_physical: number },
    qty: number
  ): { items: TransferItem[]; added: boolean; message: string } => {
    const existing = currentItems.find((i) => i.productId === product.id);
    if (existing) {
      const maxQty = product.stock_physical;
      const newQty = Math.min(existing.quantity + qty, maxQty);
      if (existing.quantity >= maxQty) {
        return { items: currentItems, added: false, message: `Estoque máximo atingido para "${product.name}" (${maxQty}).` };
      }
      return {
        items: currentItems.map((i) => i.productId === product.id ? { ...i, quantity: newQty } : i),
        added: true,
        message: `${product.name} — ${newQty} un.`,
      };
    }
    return {
      items: [...currentItems, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        barcode: product.barcode,
        quantity: qty,
        stockPhysical: product.stock_physical,
      }],
      added: true,
      message: `${product.name} adicionado — ${qty} un.`,
    };
  };

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) return;
    const trimmed = code.trim();

    try {
      // 1. Check if code matches a Kit SKU
      const matchedKit = kits?.find((k) => k.sku.toLowerCase() === trimmed.toLowerCase() && k.active);
      if (matchedKit && matchedKit.kit_items && matchedKit.kit_items.length > 0) {
        // Fetch fresh stock for all kit products
        const productIds = matchedKit.kit_items.map((ki) => ki.product_id);
        const { data: kitProducts } = await supabase
          .from("products")
          .select("id, name, sku, barcode, stock_physical")
          .in("id", productIds);

        if (!kitProducts || kitProducts.length === 0) {
          setLastScan({ success: false, message: `Produtos do kit "${matchedKit.name}" não encontrados.` });
          playBeep(200, 400);
          setScanBuffer("");
          setTimeout(() => scanInputRef.current?.focus(), 50);
          return;
        }

        let updatedItems = [...items];
        const addedNames: string[] = [];
        let hasError = false;

        for (const kitItem of matchedKit.kit_items) {
          const product = kitProducts.find((p) => p.id === kitItem.product_id);
          if (!product) {
            hasError = true;
            setLastScan({ success: false, message: `Produto do kit não encontrado.` });
            break;
          }
          if (product.stock_physical < kitItem.quantity) {
            hasError = true;
            setLastScan({ success: false, message: `"${product.name}" sem estoque suficiente (necessário: ${kitItem.quantity}, disponível: ${product.stock_physical}).` });
            break;
          }
          const result = addOrIncrementItem(updatedItems, product, kitItem.quantity);
          if (!result.added) {
            hasError = true;
            setLastScan({ success: false, message: result.message });
            break;
          }
          updatedItems = result.items;
          addedNames.push(`${product.name} (${kitItem.quantity}x)`);
        }

        if (!hasError) {
          setItems(updatedItems);
          setUsedKits((prev) => prev.includes(matchedKit.name) ? prev : [...prev, matchedKit.name]);
          setLastScan({ success: true, message: `Kit "${matchedKit.name}" — ${addedNames.join(", ")}` });
          playBeep(800, 100);
        } else {
          playBeep(200, 400);
        }

        setScanBuffer("");
        setTimeout(() => scanInputRef.current?.focus(), 50);
        return;
      }

      // 2. Regular product scan
      const { data: products } = await supabase
        .from("products")
        .select("id, name, sku, barcode, stock_physical")
        .or(`barcode.eq.${trimmed},sku.eq.${trimmed}`);

      const product = products?.[0];
      if (!product) {
        setLastScan({ success: false, message: `Produto "${trimmed}" não encontrado.` });
        playBeep(200, 400);
        setScanBuffer("");
        setTimeout(() => scanInputRef.current?.focus(), 50);
        return;
      }

      if (product.stock_physical <= 0) {
        setLastScan({ success: false, message: `"${product.name}" sem estoque físico disponível.` });
        playBeep(200, 400);
        setScanBuffer("");
        setTimeout(() => scanInputRef.current?.focus(), 50);
        return;
      }

      const result = addOrIncrementItem(items, product, 1);
      setItems(result.items);
      setLastScan({ success: result.added, message: result.message });
      playBeep(result.added ? 800 : 300, result.added ? 100 : 300);
    } catch (err: any) {
      setLastScan({ success: false, message: err.message });
    }

    setScanBuffer("");
    setTimeout(() => scanInputRef.current?.focus(), 50);
  }, [items, kits]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan(scanBuffer);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setItems(items.map((i) => {
      if (i.productId !== productId) return i;
      const newQty = Math.max(1, Math.min(i.stockPhysical, i.quantity + delta));
      return { ...i, quantity: newQty };
    }));
  };

  const removeItem = (productId: string) => {
    setItems(items.filter((i) => i.productId !== productId));
  };

  const handleAddKit = async (kit: Kit) => {
    if (!kit.kit_items || kit.kit_items.length === 0) {
      toast({ title: "Kit sem itens cadastrados.", variant: "destructive" });
      return;
    }

    const productIds = kit.kit_items.map((ki) => ki.product_id);
    const { data: kitProducts } = await supabase
      .from("products")
      .select("id, name, sku, barcode, stock_physical")
      .in("id", productIds);

    if (!kitProducts) return;

    let updatedItems = [...items];
    for (const kitItem of kit.kit_items) {
      const product = kitProducts.find((p) => p.id === kitItem.product_id);
      if (!product) continue;
      const result = addOrIncrementItem(updatedItems, product, kitItem.quantity);
      updatedItems = result.items;
    }
    setItems(updatedItems);
    toast({ title: `Kit "${kit.name}" adicionado à lista de envio!` });
  };

  const handleCreateOrder = async () => {
    if (items.length === 0) return;
    await createOrder.mutateAsync(items);
    setItems([]);
    setLastScan(null);
  };

  const playBeep = (freq: number, duration: number) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, duration);
    } catch {}
  };

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
  const activeKits = kits?.filter((k) => k.active && k.kit_items && k.kit_items.length > 0) || [];

  const statusFlow: Record<string, { next: string; label: string }> = {
    separando: { next: "enviado", label: "Marcar Enviado" },
    enviado: { next: "recebido_full", label: "Marcar Recebido" },
    recebido_full: { next: "conferido_full", label: "Confirmar FULL" },
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; class: string }> = {
      separando: { label: "Separando", class: "bg-primary/10 text-primary" },
      enviado: { label: "Enviado", class: "bg-amber-500/15 text-amber-700" },
      recebido_full: { label: "Recebido FULL", class: "bg-blue-500/15 text-blue-700" },
      conferido_full: { label: "Conferido FULL", class: "bg-emerald-500/15 text-emerald-700" },
      cancelado: { label: "Cancelado", class: "bg-destructive/15 text-destructive" },
    };
    const s = map[status] || map.separando;
    return <Badge className={s.class}>{s.label}</Badge>;
  };

  const statCounts = {
    separando: orders?.filter((o) => o.status === "separando").length ?? 0,
    enviado: orders?.filter((o) => o.status === "enviado").length ?? 0,
    recebido: orders?.filter((o) => o.status === "recebido_full").length ?? 0,
    conferido: orders?.filter((o) => o.status === "conferido_full").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Movimentação Físico → FULL</h1>
        <p className="text-muted-foreground">Envie produtos do estoque físico para o FULL Mercado Livre</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Separando", value: statCounts.separando, icon: Package },
          { label: "Enviado", value: statCounts.enviado, icon: Truck },
          { label: "Recebido FULL", value: statCounts.recebido, icon: CheckCircle },
          { label: "Conferido FULL", value: statCounts.conferido, icon: Check },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scan section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5" />
            Bipar Produtos para Envio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Direction indicator */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="font-medium">Físico</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-2">
              <Truck className="h-5 w-5 text-accent" />
              <span className="font-medium">FULL</span>
            </div>
          </div>

          {/* Scan input */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={scanInputRef}
                value={scanBuffer}
                onChange={(e) => setScanBuffer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Bipe código de barras, SKU do produto ou SKU do kit..."
                className="pl-11 text-lg h-14 font-mono"
                autoFocus
                autoComplete="off"
              />
            </div>
            <Button size="lg" className="h-14" onClick={() => handleScan(scanBuffer)} disabled={!scanBuffer.trim()}>
              Bipar
            </Button>
            <BarcodeScanner onScan={(code) => handleScan(code)} />
          </div>

          {/* Quick kit buttons */}
          {activeKits.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Boxes className="h-3.5 w-3.5" /> Adicionar Kit Rápido:
              </p>
              <div className="flex flex-wrap gap-2">
                {activeKits.map((kit) => (
                  <Button
                    key={kit.id}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleAddKit(kit)}
                  >
                    <Boxes className="h-3 w-3 mr-1" />
                    {kit.name}
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 h-4">
                      {kit.kit_items?.length || 0} itens
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Last scan feedback */}
          {lastScan && (
            <div className={`rounded-lg p-3 flex items-center gap-3 ${
              lastScan.success ? "bg-emerald-50 border border-emerald-200" : "bg-destructive/5 border border-destructive/20"
            }`}>
              {lastScan.success ? (
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              )}
              <p className="text-sm font-medium">{lastScan.message}</p>
            </div>
          )}

          {/* Items list */}
          {items.length > 0 && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Est. Físico</TableHead>
                    <TableHead className="text-center">Qtd Enviar</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-mono text-xs">{item.productSku}</TableCell>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.stockPhysical}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.productId, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-bold text-lg w-8 text-center">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.productId, 1)} disabled={item.quantity >= item.stockPhysical}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.productId)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  {items.length} produto(s) • {totalQty} unidade(s)
                </p>
                <Button onClick={handleCreateOrder} disabled={createOrder.isPending}>
                  {createOrder.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Truck className="mr-2 h-4 w-4" />
                  )}
                  Criar Ordem de Envio ({totalQty} itens)
                </Button>
              </div>
            </div>
          )}

          {items.length === 0 && !lastScan && (
            <p className="text-center text-sm text-muted-foreground py-4">
              Bipe produtos ou SKU de kits para adicionar à ordem de envio
            </p>
          )}
        </CardContent>
      </Card>

      {/* Transfer history */}
      {orders && orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ordens de Envio ({orders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Itens</TableHead>
                  <TableHead className="text-center">Qtd Total</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead className="w-[160px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const nextStep = statusFlow[order.status];
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.order_number}</TableCell>
                      <TableCell>{statusBadge(order.status)}</TableCell>
                      <TableCell className="text-center">{order.total_items}</TableCell>
                      <TableCell className="text-center font-medium">{order.total_quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {order.transfer_items?.slice(0, 3).map((ti) => (
                            <Badge key={ti.id} variant="outline" className="text-xs">
                              {ti.products?.name?.slice(0, 20)}
                              {ti.quantity > 1 && ` ×${ti.quantity}`}
                            </Badge>
                          ))}
                          {(order.transfer_items?.length ?? 0) > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(order.transfer_items?.length ?? 0) - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {nextStep && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus.mutate({ id: order.id, status: nextStep.next })}
                            disabled={updateStatus.isPending}
                          >
                            <ChevronRight className="mr-1 h-3 w-3" />
                            {nextStep.label}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MovimentacaoFull;
