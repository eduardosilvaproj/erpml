import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ScanBarcode, ShoppingCart, CreditCard, Banknote, Smartphone,
  Trash2, Plus, Minus, Loader2, CheckCircle, AlertTriangle, X,
  Package, DollarSign, Percent
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCreateSale, useSalesStats, type CartItem } from "@/hooks/useSalesData";
import { useToast } from "@/hooks/use-toast";
import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/BarcodeScannerInput";
import { useProducts } from "@/hooks/useProductData";
import { useBarcodeSearch } from "@/hooks/useBarcodeSearch";
import { BarcodeSearchDialogs } from "@/components/barcode/BarcodeSearchDialogs";
import { useNavigate } from "react-router-dom";

const PDV = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const scanInputRef = useRef<BarcodeScannerInputHandle>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scanBuffer, setScanBuffer] = useState("");
  const [lastScan, setLastScan] = useState<{ success: boolean; message: string } | null>(null);

  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [saleComplete, setSaleComplete] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<"R$" | "%">("R$");

  const createSale = useCreateSale();
  const { data: stats } = useSalesStats();
  const { data: allProducts } = useProducts();

  const productsList = allProducts?.products ?? [];

  const filteredProducts = useMemo(() => {
    const active = productsList.filter((p) => p.active && p.stock_physical > 0);
    if (!catalogSearch.trim()) return active;
    const q = catalogSearch.toLowerCase();
    return active.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [allProducts, catalogSearch]);

  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

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

  const addToCart = useCallback((product: { id: string; name: string; sku: string; barcode: string | null; price: number; stock_physical: number }) => {
    const existing = cart.find((i) => i.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.stock_physical) {
        toast({ title: "Estoque máximo", description: `Máximo de ${product.stock_physical} unidades.`, variant: "destructive" });
        return;
      }
      setCart(cart.map((i) =>
        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        barcode: product.barcode,
        quantity: 1,
        unitPrice: product.price,
        stockPhysical: product.stock_physical,
      }]);
    }
    playBeep(800, 100);
  }, [cart, toast]);

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) return;

    try {
      const { data: products } = await supabase
        .from("products")
        .select("id, name, sku, barcode, ean, price, stock_physical")
        .or(`ean.eq.${code.trim()},barcode.eq.${code.trim()},sku.eq.${code.trim()}`);

      let product = products?.[0];

      if (!product) {
        // Fallback: check alternative GTINs
        const { data: altGtinMatch } = await supabase
          .from("product_alternative_gtins")
          .select("product_id")
          .eq("gtin", code.trim())
          .maybeSingle();

        if (altGtinMatch) {
          const { data: altProduct } = await supabase
            .from("products")
            .select("id, name, sku, barcode, ean, price, stock_physical")
            .eq("id", altGtinMatch.product_id)
            .maybeSingle();
          if (altProduct) product = altProduct;
        }
      }

      if (!product) {
        setLastScan({ success: false, message: `Produto "${code}" não encontrado.` });
        playBeep(200, 400);
        scanInputRef.current?.flash(false);
        setScanBuffer("");
        return;
      }

      if (product.stock_physical <= 0) {
        setLastScan({ success: false, message: `"${product.name}" sem estoque.` });
        playBeep(200, 400);
        scanInputRef.current?.flash(false);
        setScanBuffer("");
        return;
      }

      const existing = cart.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_physical) {
          setLastScan({ success: false, message: `Estoque máximo atingido (${product.stock_physical}).` });
          playBeep(300, 300);
        } else {
          setCart(cart.map((i) =>
            i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
          ));
          setLastScan({ success: true, message: `${product.name} — ${existing.quantity + 1}x R$ ${product.price.toFixed(2)}` });
          playBeep(800, 100);
          scanInputRef.current?.flash(true);
        }
      } else {
        setCart([...cart, {
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          barcode: product.barcode,
          quantity: 1,
          unitPrice: product.price,
          stockPhysical: product.stock_physical,
        }]);
        setLastScan({ success: true, message: `${product.name} — R$ ${product.price.toFixed(2)}` });
        playBeep(800, 100);
        scanInputRef.current?.flash(true);
      }
    } catch (err: any) {
      setLastScan({ success: false, message: err.message });
    }

    setScanBuffer("");
    setTimeout(() => scanInputRef.current?.focus(), 50);
  }, [cart]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan(scanBuffer);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(cart.map((i) => {
      if (i.productId !== productId) return i;
      const newQty = Math.max(1, Math.min(i.stockPhysical, i.quantity + delta));
      return { ...i, quantity: newQty };
    }));
  };

  const removeItem = (productId: string) => {
    setCart(cart.filter((i) => i.productId !== productId));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  const discountAmount = useMemo(() => {
    const v = parseFloat(discountValue) || 0;
    if (v <= 0) return 0;
    if (discountType === "%") return Math.min(subtotal, subtotal * (v / 100));
    return Math.min(subtotal, v);
  }, [discountValue, discountType, subtotal]);

  const total = subtotal - discountAmount;

  const handleFinalizeSale = async () => {
    if (!selectedPayment || cart.length === 0) return;
    try {
      await createSale.mutateAsync({
        items: cart,
        paymentMethod: selectedPayment,
        discount: discountAmount,
      });
      setCart([]);
      setLastScan(null);
      setSelectedPayment(null);
      setDiscountValue("");
      setSaleComplete(true);
      playBeep(1000, 200);
      setTimeout(() => {
        setSaleComplete(false);
        scanInputRef.current?.focus();
      }, 3000);
    } catch {
      // Error is handled by the mutation's onError callback
    }
  };

  const newSale = () => {
    setCart([]);
    setLastScan(null);
    setSelectedPayment(null);
    setDiscountValue("");
    setSaleComplete(false);
    setTimeout(() => scanInputRef.current?.focus(), 50);
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (saleComplete) {
    return (
      <div className="flex min-h-[60vh] md:h-[calc(100vh-6rem)] items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-4 rounded-full bg-emerald-500/20 p-4">
              <CheckCircle className="h-12 w-12 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold">Venda finalizada!</p>
            <p className="text-muted-foreground mt-1">Estoque atualizado automaticamente</p>
            <Button className="mt-6" onClick={newSale}>Nova Venda</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3" style={{ minHeight: 'calc(100vh - 6rem)' }}>
      {/* Left: Product scan + catalog + cart */}
      <div className="md:col-span-2 space-y-4 flex flex-col min-h-[50vh] md:min-h-0">
        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Vendas Hoje</p>
                <p className="font-bold">{stats?.salesToday ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <Banknote className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Faturamento Hoje</p>
                <p className="font-bold">{formatCurrency(stats?.revenueToday ?? 0)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="flex-1 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanBarcode className="h-5 w-5" />
              Ponto de Venda
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <BarcodeScannerInput
                  ref={scanInputRef}
                  value={scanBuffer}
                  onChange={(v) => setScanBuffer(v)}
                  onScan={(code) => handleScan(code)}
                  placeholder="Bipe o código de barras ou digite e pressione Enter..."
                  inputClassName="text-lg h-12 font-mono"
                  icon={<ScanBarcode className="h-5 w-5" />}
                  autoFocus
                  scanMode
                />
              </div>
              <Button className="h-12" onClick={() => handleScan(scanBuffer)} disabled={!scanBuffer.trim()}>
                Bipar
              </Button>
            </div>

            {lastScan && (
              <div className={`rounded-lg p-2 flex items-center gap-2 text-sm ${
                lastScan.success ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-destructive/10 border border-destructive/30 text-destructive"
              }`}>
                {lastScan.success ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <span>{lastScan.message}</span>
              </div>
            )}
          </CardHeader>

          {/* Product Catalog */}
          <div className="px-6 pb-3">
            <div className="relative mb-3">
              <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Buscar produto no catálogo..."
                className="pl-10 h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-[240px] overflow-y-auto pr-1">
              {filteredProducts.length > 0 ? filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart({
                    id: product.id,
                    name: product.name,
                    sku: product.sku,
                    barcode: product.barcode,
                    price: product.price,
                    stock_physical: product.stock_physical,
                  })}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border/40 bg-muted/20 hover:bg-primary/10 hover:border-primary/40 transition-all text-center group"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-12 w-12 rounded-lg object-cover bg-background"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-muted/40 flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                  <p className="text-[11px] font-medium text-foreground leading-tight line-clamp-2">{product.name}</p>
                  <p className="text-[11px] font-bold text-primary">{formatCurrency(product.price)}</p>
                </button>
              )) : (
                <div className="col-span-3 py-6 text-center text-xs text-muted-foreground">
                  Nenhum produto encontrado
                </div>
              )}
            </div>
          </div>

          <Separator />

          <CardContent className="flex-1 overflow-auto pt-3">
            {cart.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{item.productSku}</p>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.productId, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-bold w-6 text-center">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.productId, 1)} disabled={item.quantity >= item.stockPhysical}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.unitPrice * item.quantity)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(item.productId)}>
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <ShoppingCart className="mb-3 h-12 w-12 opacity-20" />
                <p className="text-base font-medium">Pronto para vender!</p>
                <p className="text-sm mt-1">Bipe um produto ou busque no catálogo acima.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Summary */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Resumo da Venda</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.productId} className="flex justify-between text-sm">
                <span className="truncate flex-1">{item.quantity}x {item.productName}</span>
                <span className="font-medium ml-2">{formatCurrency(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            {cart.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum item</p>
            )}
          </div>
          <div className="space-y-4">
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{cart.reduce((s, i) => s + i.quantity, 0)} itens</span>
              <span className="text-sm text-muted-foreground">Subtotal: {formatCurrency(subtotal)}</span>
            </div>

            {/* Discount */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Desconto</label>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setDiscountType("R$")}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      discountType === "R$"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <DollarSign className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setDiscountType("%")}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      discountType === "%"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Percent className="h-3 w-3" />
                  </button>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === "%" ? "0%" : "0,00"}
                  className="h-8 text-sm flex-1"
                  disabled={cart.length === 0}
                />
              </div>
              {discountAmount > 0 && (
                <p className="text-xs text-emerald-400">
                  − {formatCurrency(discountAmount)} de desconto
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-2xl font-bold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "dinheiro", label: "Dinheiro", icon: Banknote },
                { key: "pix", label: "Pix", icon: Smartphone },
                { key: "cartao", label: "Cartão", icon: CreditCard },
              ].map((pm) => (
                <Button
                  key={pm.key}
                  variant={selectedPayment === pm.key ? "default" : "outline"}
                  className="flex flex-col gap-1 h-auto py-3"
                  disabled={cart.length === 0}
                  onClick={() => setSelectedPayment(pm.key)}
                >
                  <pm.icon className="h-5 w-5" />
                  <span className="text-xs">{pm.label}</span>
                </Button>
              ))}
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={cart.length === 0 || !selectedPayment || createSale.isPending}
              onClick={handleFinalizeSale}
            >
              {createSale.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Finalizar Venda
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PDV;
