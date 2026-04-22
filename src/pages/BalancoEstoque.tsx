import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ClipboardList, Search, Loader2, AlertTriangle, CheckCircle2,
  FileText, Download, Plus, Minus, RotateCcw, PackageCheck, ScanBarcode, Camera, Volume2,
  ShieldCheck, EyeOff, Filter, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useProducts, useAllProducts, useCategories } from "@/hooks/useProductData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompanyId } from "@/hooks/useCompanyId";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { formatNumber as sharedFormatNumber, formatDifference as sharedFormatDifference, formatPercent as sharedFormatPercent } from "@/lib/formatters";

const BalancoEstoque = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [onlyDivergent, setOnlyDivergent] = useState(false);
  const [showOnlyCounted, setShowOnlyCounted] = useState(false);
  const [balanceType, setBalanceType] = useState<"full" | "partial">("full");
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [isCounting, setIsCounting] = useState(false);
  const [monthsBack, setMonthsBack] = useState("3");
  const [bipMode, setBipMode] = useState(false);
  const [lastScanned, setLastScanned] = useState<{ name: string; sku: string; count: number } | null>(null);
  const bipInputRef = useRef<HTMLInputElement>(null);
  const bipBufferRef = useRef("");
  const bipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [decimalPlaces, setDecimalPlaces] = useState(0);

  const formatNumber = useCallback((num: number, decimals: number = decimalPlaces) => {
    return sharedFormatNumber(num, decimals);
  }, [decimalPlaces]);

  const formatDifference = useCallback((num: number, decimals: number = decimalPlaces) => {
    return sharedFormatDifference(num, decimals);
  }, [decimalPlaces]);

  const formatPercent = useCallback((num: number, decimals: number = 1) => {
    return sharedFormatPercent(num, decimals);
  }, []);


  // Carrega TODOS os produtos (paginado) para evitar o teto de 1000 do Supabase.
  // Os filtros de busca/categoria são aplicados em memória abaixo.
  const { data, isLoading } = useAllProducts();
  const { data: categories } = useCategories();
  const allProductsRaw = data?.products || [];
  const products = useMemo(() => {
    let list = allProductsRaw;
    if (categoryFilter) list = list.filter((p) => p.category_id === categoryFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(s) ||
          p.sku?.toLowerCase().includes(s) ||
          p.barcode?.toLowerCase().includes(s)
      );
    }
    if (showOnlyCounted && isCounting) {
      list = list.filter((p) => counts[p.id] !== null && counts[p.id] !== undefined);
    }
    return list;
  }, [allProductsRaw, categoryFilter, search, showOnlyCounted, counts, isCounting]);

  // Fetch invoices from the last N months for comparison
  const sinceDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - parseInt(monthsBack));
    return d.toISOString();
  }, [monthsBack]);

  const { data: invoiceEntries, isLoading: loadingInvoices } = useQuery({
    queryKey: ["balance-invoices", companyId, sinceDate],
    queryFn: async () => {
      if (!companyId) return [];
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, number, issuer_name, imported_at, total_value")
        .eq("company_id", companyId)
        .gte("imported_at", sinceDate)
        .order("imported_at", { ascending: false });

      if (!invoices?.length) return [];

      const invoiceIds = invoices.map((i) => i.id);
      const { data: items } = await supabase
        .from("invoice_items")
        .select("product_id, quantity, xml_description, invoice_id")
        .in("invoice_id", invoiceIds)
        .not("product_id", "is", null);

      const byProduct: Record<string, { totalQty: number; invoiceCount: number; descriptions: string[] }> = {};
      for (const item of items || []) {
        if (!item.product_id) continue;
        if (!byProduct[item.product_id]) {
          byProduct[item.product_id] = { totalQty: 0, invoiceCount: 0, descriptions: [] };
        }
        byProduct[item.product_id].totalQty += Number(item.quantity);
        byProduct[item.product_id].invoiceCount++;
        if (!byProduct[item.product_id].descriptions.includes(item.xml_description)) {
          byProduct[item.product_id].descriptions.push(item.xml_description);
        }
      }

      return { invoices, byProduct, totalInvoices: invoices.length };
    },
    enabled: !!companyId,
  });

  const invoiceData = invoiceEntries as { invoices: any[]; byProduct: Record<string, { totalQty: number; invoiceCount: number; descriptions: string[] }>; totalInvoices: number } | undefined;

  const startCounting = () => {
    setIsCounting(true);
    const initial: Record<string, number | null> = {};
    
    // In partial mode, we might want to start with a blank list or just the filtered ones
    // But for now, let's keep the product list as the base
    products.forEach((p) => { initial[p.id] = null; });
    
    setCounts(initial);
    setZeroUnscanned(balanceType === "full");
    
    toast({ 
      title: balanceType === "full" ? "Balanço Geral iniciado" : "Balanço Parcial iniciado", 
      description: balanceType === "full" 
        ? "Todos os produtos da lista foram incluídos." 
        : "Apenas produtos selecionados serão ajustados." 
    });
  };

  const resetCounting = () => {
    setIsCounting(false);
    setCounts({});
    setBipMode(false);
    setLastScanned(null);
    setShowOnlyCounted(false);
  };

  // Toggle: also zero-out items that were NOT counted/bipped during this balance
  const [zeroUnscanned, setZeroUnscanned] = useState(false);

  // Items that will be zeroed:
  // - explicitly counted as 0
  // - (if zeroUnscanned) not counted at all AND currently have stock > 0
  const itemsToZero = useMemo(() => {
    // Use allProductsRaw when zeroing to ensure we catch everything regardless of filters
    const baseList = zeroUnscanned ? allProductsRaw : products;
    return baseList.filter((p) => {
      const c = counts[p.id];
      const explicitZero = c === 0;
      const unscannedWithStock =
        zeroUnscanned && (c === null || c === undefined) && p.stock_physical > 0;
      return explicitZero || unscannedWithStock;
    });
  }, [allProductsRaw, products, counts, zeroUnscanned]);

  // Apply adjustments: update stock_physical for counted items.
  // If zeroUnscanned is enabled, also zero out items that were not bipped.
  const applyAdjustments = async () => {
    // Important: Use allProductsRaw here to ensure items counted under different 
    // filters are still processed, and zeroing respects the full catalog if enabled.
    const updates = allProductsRaw
      .map((p) => {
        const counted = counts[p.id];
        const hasCount = counted !== null && counted !== undefined && !isNaN(counted as number);
        
        if (hasCount) {
          return (counted as number) !== p.stock_physical ? { p, newQty: counted as number } : null;
        }
        
        // Lock: only zero out automatically if it's a full balance AND the option is enabled.
        // In partial balance, we NEVER zero out automatically.
        if (zeroUnscanned && balanceType === "full" && p.stock_physical > 0) {
          return { p, newQty: 0 };
        }
        return null;
      })
      .filter(Boolean) as Array<{ p: any; newQty: number }>;

    if (updates.length === 0) {
      toast({ title: "Nada a ajustar", description: "Nenhum item contado difere do estoque atual." });
      return;
    }

    setApplying(true);
    let ok = 0, fail = 0;
    for (const { p, newQty } of updates) {
      const { error } = await supabase
        .from("products")
        .update({ stock_physical: newQty })
        .eq("id", p.id);
      if (error) fail++; else ok++;
    }
    setApplying(false);

    toast({
      title: "Balanço finalizado",
      description: `${ok} produto(s) ajustado(s)${fail ? `, ${fail} falha(s)` : ""}.`,
    });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    resetCounting();
  };

  const updateCount = (productId: string, value: string) => {
    const num = value === "" ? null : parseFloat(value.replace(',', '.'));
    setCounts((prev) => ({ ...prev, [productId]: isNaN(num as number) ? null : num }));
  };


  // Handle barcode scan (from bip or camera) — increment count by 1
  const handleBarcodeScan = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed || !isCounting) return;

    // Find product by barcode, sku, or sku_ml in ALL products
    const product = allProductsRaw.find(
      (p) => p.barcode === trimmed || p.sku === trimmed || p.sku_ml === trimmed
    );

    if (!product) {
      toast({
        title: "Produto não encontrado",
        description: `Código "${trimmed}" não corresponde a nenhum produto cadastrado.`,
        variant: "destructive",
      });
      setLastScanned(null);
      return;
    }

    setCounts((prev) => {
      const current = prev[product.id] ?? 0;
      const newCount = current + 1;
      setLastScanned({ name: product.name, sku: product.sku, count: newCount });
      return { ...prev, [product.id]: newCount };
    });

    toast({
      title: `✓ ${product.name}`,
      description: `Contagem: ${(counts[product.id] ?? 0) + 1}`,
    });
  }, [isCounting, products, counts, toast]);

  // Hardware bip: auto-focus input and process keyboard-emulated barcode
  useEffect(() => {
    if (bipMode && isCounting && bipInputRef.current) {
      bipInputRef.current.focus();
    }
  }, [bipMode, isCounting]);

  const handleBipKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = bipBufferRef.current.trim();
      if (code) {
        handleBarcodeScan(code);
      }
      bipBufferRef.current = "";
      if (bipInputRef.current) bipInputRef.current.value = "";
    }
  };

  const handleBipInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    bipBufferRef.current = e.target.value;
    // Auto-submit after 300ms of no input (for fast scanners)
    if (bipTimerRef.current) clearTimeout(bipTimerRef.current);
    bipTimerRef.current = setTimeout(() => {
      const code = bipBufferRef.current.trim();
      if (code.length >= 4) {
        handleBarcodeScan(code);
        bipBufferRef.current = "";
        if (bipInputRef.current) bipInputRef.current.value = "";
      }
    }, 300);
  };

  // Compute divergences
  const divergences = useMemo(() => {
    if (!isCounting) return [];
    // Use allProductsRaw so that divergences (and summary stats) reflect the entire 
    // balance session, regardless of current UI filters applied to the table.
    return allProductsRaw
      .map((p) => {
        const counted = counts[p.id];
        if (counted === null || counted === undefined) return null;
        const registered = p.stock_physical;
        const diff = counted - registered;
        const invoiceInfo = invoiceData?.byProduct?.[p.id];
        const variationPercentage = p.stock_physical > 0 ? (diff / p.stock_physical) * 100 : (diff > 0 ? 100 : 0);
        return {
          product: p,
          counted,
          registered,
          diff,
          variationPercentage,
          invoiceQtyEntered: invoiceInfo?.totalQty || 0,
          invoiceCount: invoiceInfo?.invoiceCount || 0,
        };
      })
      .filter(Boolean) as Array<{
        product: typeof products[0];
        counted: number;
        registered: number;
        diff: number;
        variationPercentage: number;
        invoiceQtyEntered: number;
        invoiceCount: number;
      }>;
  }, [products, counts, isCounting, invoiceData]);

  const divergentItems = divergences.filter((d) => d.diff !== 0);
  const totalCounted = divergences.length;
  const totalDivergent = divergentItems.length;
  const totalSurplus = divergentItems.filter((d) => d.diff > 0).reduce((s, d) => s + d.diff, 0);
  const totalDeficit = divergentItems.filter((d) => d.diff < 0).reduce((s, d) => s + Math.abs(d.diff), 0);

  const displayedDivergences = onlyDivergent ? divergentItems : divergences;

  const auditStats = useMemo(() => {
    if (!isCounting) return null;
    
    const totalInSystem = allProductsRaw.length;
    // scopeProducts are items that match search/category filters
    const scopeProducts = allProductsRaw.filter(p => {
      let matches = true;
      if (categoryFilter) matches = matches && p.category_id === categoryFilter;
      if (search) {
        const s = search.toLowerCase();
        matches = matches && (
          p.name?.toLowerCase().includes(s) ||
          p.sku?.toLowerCase().includes(s) ||
          p.barcode?.toLowerCase().includes(s)
        );
      }
      return matches;
    });
    
    const itemsInScopeCount = scopeProducts.length;
    const countedIds = Object.keys(counts).filter(id => counts[id] !== null);
    const countedCount = countedIds.length;
    
    // Items in system but NOT in current filter/scope
    const ignoredByFilterCount = totalInSystem - itemsInScopeCount;
    
    // Items that will NOT be updated. 
    // In Partial Balance, everything outside the 'counts' is protected.
    // In Full Balance, if zeroUnscanned=false, everything outside 'counts' is protected.
    // If zeroUnscanned=true, nothing is protected (either counted or zeroed).
    let protectedCount = 0;
    if (balanceType === "partial") {
      protectedCount = totalInSystem - countedCount;
    } else {
      protectedCount = zeroUnscanned ? 0 : totalInSystem - countedCount;
    }
    
    return {
      totalInSystem,
      itemsInScopeCount,
      countedCount,
      ignoredByFilterCount,
      protectedCount
    };
  }, [allProductsRaw, categoryFilter, search, counts, isCounting, balanceType, zeroUnscanned]);

  const auditItemsList = useMemo(() => {
    if (!isCounting) return [];
    
    const list = allProductsRaw.map(p => {
      const counted = counts[p.id];
      const isCounted = counted !== null && counted !== undefined;
      
      let inScope = true;
      if (categoryFilter) inScope = inScope && p.category_id === categoryFilter;
      if (search) {
        const s = search.toLowerCase();
        inScope = inScope && (
          p.name?.toLowerCase().includes(s) ||
          p.sku?.toLowerCase().includes(s) ||
          p.barcode?.toLowerCase().includes(s)
        );
      }

      let status = "";
      if (!inScope) {
        status = "Ignorado";
      } else if (isCounted) {
        status = "Contado";
      } else {
        const willBeZeroed = balanceType === "full" && zeroUnscanned;
        status = willBeZeroed ? "Zerar" : "Protegido";
      }

      const countedStock = isCounted ? (counted as number) : (status === "Zerar" ? 0 : p.stock_physical);
      const difference = countedStock - p.stock_physical;
      const variationPercentage = p.stock_physical > 0 ? (difference / p.stock_physical) * 100 : (difference > 0 ? 100 : 0);
      const hasDivergence = isCounted && counted !== p.stock_physical;

      let action = "";
      if (status === "Ignorado") {
        action = "Fora do filtro";
      } else if (status === "Contado") {
        action = !hasDivergence ? "Manter (Sem divergência)" : `Ajustar: ${formatNumber(p.stock_physical)} → ${formatNumber(counted as number)} (${formatDifference(difference)})`;
      } else if (status === "Zerar") {
        action = `Zerar: ${formatNumber(p.stock_physical)} → ${formatNumber(0)} (${formatDifference(difference)})`;
      } else {
        action = "Protegido";
      }
      
      return {
        id: p.id,
        sku: p.sku || "N/A",
        name: p.name || "Sem nome",
        currentStock: p.stock_physical,
        countedStock,
        difference,
        variationPercentage,
        action,
        status,
        hasDivergence,
        isCounted
      };
    });

    return list.sort((a, b) => {
      if (a.hasDivergence && !b.hasDivergence) return -1;
      if (!a.hasDivergence && b.hasDivergence) return 1;
      if (a.isCounted && !b.isCounted) return -1;
      if (!a.isCounted && b.isCounted) return 1;
      return 0;
    });
  }, [allProductsRaw, counts, categoryFilter, search, isCounting, balanceType, zeroUnscanned, formatNumber, formatDifference]);


  const exportReport = () => {
    if (divergences.length === 0) {
      toast({ title: "Nenhum dado", description: "Realize a contagem primeiro.", variant: "destructive" });
      return;
    }
    const lines = [
      "SKU,Produto,Estoque Registrado,Contagem Física,Diferença,Entrada NF (últimos meses),Status",
      ...divergences.map((d) =>
        `"${d.product.sku}","${d.product.name}",${d.registered},${d.counted},${d.diff},${d.invoiceQtyEntered},${d.diff === 0 ? "OK" : d.diff > 0 ? "Sobra" : "Falta"}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balanco-estoque-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Relatório exportado!", description: "CSV baixado com sucesso." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Balanço de Estoque
            {isCounting && (
              <Badge variant={balanceType === "full" ? "default" : "outline"} className="ml-2">
                {balanceType === "full" ? "Geral" : "Parcial"}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            {isCounting 
              ? `Contagem em andamento (${balanceType === "full" ? "Geral" : "Parcial"})`
              : "Contagem física do inventário com comparação de notas fiscais"
            }
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isCounting ? (
            <div className="flex gap-2">
              <Select value={balanceType} onValueChange={(v: "full" | "partial") => setBalanceType(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tipo de Balanço" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Balanço Geral</SelectItem>
                  <SelectItem value="partial">Balanço Parcial</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={startCounting} disabled={isLoading || products.length === 0}>
                <PackageCheck className="h-4 w-4 mr-2" />
                Iniciar
              </Button>
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={resetCounting}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button variant="outline" onClick={exportReport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={applying}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {applying ? "Aplicando..." : "Finalizar e Aplicar"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar ajuste de estoque?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3 text-sm">
                        <p>
                          Produtos com contagem registrada terão o estoque atualizado.
                          Por padrão, itens <strong>não bipados</strong> mantêm o estoque atual.
                        </p>
                        <div className={`flex items-start gap-2 p-3 rounded-md border ${balanceType === "partial" ? "bg-muted/20 opacity-70" : "bg-muted/40"}`}>
                          <Switch
                            id="zero-unscanned"
                            checked={zeroUnscanned}
                            onCheckedChange={setZeroUnscanned}
                            disabled={balanceType === "partial"}
                            className="mt-0.5"
                          />
                          <Label htmlFor="zero-unscanned" className={`cursor-pointer leading-tight ${balanceType === "partial" ? "cursor-not-allowed" : ""}`}>
                            <span className="font-medium text-foreground">Zerar itens não bipados</span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {balanceType === "partial" 
                                ? "Opção desabilitada em Balanço Parcial para evitar erros." 
                                : "Considerar todos os produtos não contados como estoque zero."
                              }
                            </span>
                          </Label>
                        </div>
                        {itemsToZero.length > 0 && (
                          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                            <p className="font-medium text-destructive flex items-center gap-1.5">
                              <AlertTriangle className="h-4 w-4" />
                              {itemsToZero.length} produto(s) serão zerados:
                            </p>
                            <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                              {itemsToZero.slice(0, 50).map((p) => (
                                <div key={p.id} className="flex justify-between gap-2 py-0.5 border-b border-destructive/10 last:border-0">
                                  <span className="truncate">{p.name}</span>
                                  <span className="text-muted-foreground shrink-0">
                                    {p.stock_physical} → 0
                                  </span>
                                </div>
                              ))}
                              {itemsToZero.length > 50 && (
                                <p className="text-muted-foreground italic pt-1">
                                  ... e mais {itemsToZero.length - 50} item(ns)
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={applyAdjustments}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Bip / Camera scanner section — only visible when counting */}
      {isCounting && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanBarcode className="h-5 w-5 text-primary" />
              Coleta por Código de Barras
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <Switch
                  id="bip-mode"
                  checked={bipMode}
                  onCheckedChange={(v) => {
                    setBipMode(v);
                    if (v) setTimeout(() => bipInputRef.current?.focus(), 100);
                  }}
                />
                <Label htmlFor="bip-mode" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <ScanBarcode className="h-4 w-4" />
                  Modo Bip (Scanner)
                </Label>
              </div>
              <BarcodeScanner onScan={handleBarcodeScan} disabled={!isCounting} />
            </div>

            {/* Hardware bip input field */}
            {bipMode && (
              <div className="space-y-2">
                <div className="relative">
                  <ScanBarcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                  <Input
                    ref={bipInputRef}
                    className="pl-11 h-14 text-lg font-mono border-primary/40 focus:border-primary bg-background"
                    placeholder="Aguardando leitura do bip..."
                    onKeyDown={handleBipKeyDown}
                    onChange={handleBipInput}
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Volume2 className="h-3 w-3" />
                  Aponte o leitor de código de barras para o produto. A leitura será registrada automaticamente.
                </p>
              </div>
            )}

            {/* Last scanned feedback */}
            {lastScanned && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-primary/20">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lastScanned.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {lastScanned.sku}</p>
                </div>
                <Badge className="bg-primary/15 text-primary text-lg px-3 py-1">
                  {lastScanned.count}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Itens Contados</p>
              <p className="text-2xl font-bold">{totalCounted}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-destructive/10 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Divergências</p>
              <p className="text-2xl font-bold text-destructive">{totalDivergent}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Sobras</p>
              <p className="text-2xl font-bold text-primary">{formatDifference(totalSurplus)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-destructive/10 p-2">
              <Minus className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Faltas</p>
              <p className="text-2xl font-bold text-destructive">{formatDifference(-totalDeficit)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="counting" className="space-y-4">
        <TabsList>
          <TabsTrigger value="counting">Contagem</TabsTrigger>
          <TabsTrigger value="report">Relatório de Divergências</TabsTrigger>
          {isCounting && <TabsTrigger value="audit">Auditoria</TabsTrigger>}
          <TabsTrigger value="invoices">Notas Fiscais Referência</TabsTrigger>
        </TabsList>

        {/* Tab: Contagem */}
        <TabsContent value="counting" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {isCounting && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Switch 
                      id="show-only-counted" 
                      checked={showOnlyCounted} 
                      onCheckedChange={setShowOnlyCounted} 
                    />
                    <Label htmlFor="show-only-counted" className="text-sm whitespace-nowrap cursor-pointer">
                      Apenas contados
                    </Label>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : products.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-center">Est. Registrado</TableHead>
                        <TableHead className="text-center">Entrada NF</TableHead>
                        {isCounting && <TableHead className="text-center">Contagem Física</TableHead>}
                        {isCounting && <TableHead className="text-center">Diferença</TableHead>}
                        {isCounting && <TableHead>Status</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((p) => {
                        const counted = counts[p.id];
                        const diff = counted != null ? counted - p.stock_physical : null;
                        const invoiceInfo = invoiceData?.byProduct?.[p.id];
                        const isLastScanned = lastScanned?.sku === p.sku;
                        return (
                          <TableRow
                            key={p.id}
                            className={`${diff != null && diff !== 0 ? "bg-destructive/5" : ""} ${isLastScanned ? "ring-2 ring-primary/30 bg-primary/5" : ""}`}
                          >
                            <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="text-center font-bold">{formatNumber(p.stock_physical)}</TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {invoiceInfo ? invoiceInfo.totalQty : "—"}
                            </TableCell>
                            {isCounting && (
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="w-24 mx-auto text-center"

                                  value={counted ?? ""}
                                  onChange={(e) => updateCount(p.id, e.target.value)}
                                  placeholder="0"
                                />
                              </TableCell>
                            )}
                            {isCounting && (
                              <TableCell className="text-center font-bold">
                                {diff != null ? (
                                  <span className={diff === 0 ? "text-primary" : "text-destructive"}>
                                    {formatDifference(diff)}
                                  </span>
                                ) : "—"}
                              </TableCell>

                            )}
                            {isCounting && (
                              <TableCell>
                                {diff == null ? (
                                  <Badge variant="secondary">Pendente</Badge>
                                ) : diff === 0 ? (
                                  <Badge className="bg-primary/15 text-primary gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> OK
                                  </Badge>
                                ) : diff > 0 ? (
                                  <Badge className="bg-accent/15 text-accent-foreground gap-1">
                                    <Plus className="h-3 w-3" /> Sobra
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="gap-1">
                                    <Minus className="h-3 w-3" /> Falta
                                  </Badge>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ClipboardList className="mb-4 h-12 w-12 opacity-30" />
                  <p>Nenhum produto cadastrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Relatório */}
        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Relatório de Divergências
                </CardTitle>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch id="only-div" checked={onlyDivergent} onCheckedChange={setOnlyDivergent} />
                    <Label htmlFor="only-div" className="text-sm cursor-pointer">Apenas divergentes</Label>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportReport}>
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!isCounting || divergences.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ClipboardList className="mb-4 h-10 w-10 opacity-30" />
                  <p className="text-sm">
                    {!isCounting
                      ? "Inicie o balanço para ver o relatório de divergências"
                      : "Insira a contagem física dos produtos para gerar o relatório"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-center">Registrado</TableHead>
                        <TableHead className="text-center">Contado</TableHead>
                        <TableHead className="text-center">Diferença</TableHead>
                        <TableHead className="text-center">% Var.</TableHead>
                        <TableHead className="text-center">Entrada NF</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedDivergences.map((d) => (
                        <TableRow key={d.product.id} className={d.diff !== 0 ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-xs">{d.product.sku}</TableCell>
                          <TableCell className="font-medium">{d.product.name}</TableCell>
                          <TableCell className="text-center">{formatNumber(d.registered)}</TableCell>
                          <TableCell className="text-center font-bold">{formatNumber(d.counted)}</TableCell>
                          <TableCell className="text-center font-bold">
                            <span className={d.diff === 0 ? "text-primary" : "text-destructive"}>
                              {formatDifference(d.diff)}
                            </span>
                          </TableCell>
                          <TableCell className={`text-center text-xs font-medium ${d.variationPercentage > 0 ? 'text-amber-600' : d.variationPercentage < 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                            {formatPercent(d.variationPercentage)}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {d.invoiceQtyEntered > 0 ? `${formatNumber(d.invoiceQtyEntered)} (${d.invoiceCount} NFs)` : "—"}
                          </TableCell>

                          <TableCell>
                            {d.diff === 0 ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">OK</Badge>
                            ) : d.diff > 0 ? (
                              <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">Sobra</Badge>
                            ) : (
                              <Badge variant="destructive">Falta</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Auditoria */}
        {isCounting && (
          <TabsContent value="audit" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    Itens Contados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-bold">{auditStats?.countedCount}</p>
                    <p className="text-xs text-muted-foreground">de {auditStats?.itemsInScopeCount} no escopo</p>
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-primary/10">
                    <div 
                      className="h-full rounded-full bg-primary transition-all duration-500" 
                      style={{ width: `${Math.min(100, (auditStats?.countedCount || 0) / (auditStats?.itemsInScopeCount || 1) * 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-muted bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Filter className="h-4 w-4" />
                    Ignorados por Filtro
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{auditStats?.ignoredByFilterCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Produtos ocultos pelos filtros atuais (Categoria/Busca).
                  </p>
                </CardContent>
              </Card>

              <Card className="border-accent/30 bg-accent/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-accent-foreground">
                    <ShieldCheck className="h-4 w-4" />
                    Itens Protegidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{auditStats?.protectedCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Itens que <strong>NÃO</strong> terão o estoque alterado.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="h-5 w-5 text-muted-foreground" />
                  Resumo da Operação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 p-3 rounded-md bg-muted/30">
                    <h4 className="font-semibold text-sm">Escopo do Balanço ({balanceType === "full" ? "Geral" : "Parcial"})</h4>
                    <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
                      <li>Total no sistema: {auditStats?.totalInSystem}</li>
                      <li>Itens visíveis (escopo): {auditStats?.itemsInScopeCount}</li>
                      <li>Itens fora do escopo: {auditStats?.ignoredByFilterCount}</li>
                    </ul>
                  </div>
                  <div className="space-y-2 p-3 rounded-md bg-muted/30">
                    <h4 className="font-semibold text-sm">Previsão de Atualização</h4>
                    <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
                      <li>Total a atualizar: {auditStats?.countedCount}</li>
                      <li>Total a zerar: {zeroUnscanned && balanceType === "full" ? (auditStats?.itemsInScopeCount || 0) - (auditStats?.countedCount || 0) : 0}</li>
                      <li>Total protegidos: {auditStats?.protectedCount}</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex items-start gap-2 p-3 rounded-md border bg-primary/5 text-xs text-primary/80">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>
                    {balanceType === "partial" 
                      ? "Em modo Balanço Parcial, apenas produtos que você contar explicitamente serão atualizados. Itens filtrados ou não bipados permanecem com seu estoque atual inalterado."
                      : "Em modo Balanço Geral, se a opção 'Zerar itens não bipados' estiver ativada, todos os itens do sistema não contados serão zerados. Caso contrário, apenas os contados são atualizados."
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                  Detalhamento da Auditoria
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="decimal-places" className="text-xs text-muted-foreground">Casas decimais:</Label>
                  <Select 
                    value={String(decimalPlaces)} 
                    onValueChange={(v) => setDecimalPlaces(Number(v))}
                  >
                    <SelectTrigger id="decimal-places" className="h-7 w-[70px] text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>

                <div className="rounded-md border max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="text-right">Sistema</TableHead>
                        <TableHead className="text-right">Contado</TableHead>
                        <TableHead className="text-right">Dif.</TableHead>
                        <TableHead className="text-right">% Var.</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditItemsList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhum item para exibir.
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditItemsList.map((item) => (
                          <TableRow 
                            key={item.id} 
                            className={item.hasDivergence ? "bg-amber-50 dark:bg-amber-950/20" : ""}
                          >
                            <TableCell className="font-mono text-[10px]">{item.sku}</TableCell>
                            <TableCell className="max-w-[150px] md:max-w-[200px] truncate text-xs" title={item.name}>
                              {item.name}
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium">{formatNumber(item.currentStock)}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{formatNumber(item.countedStock)}</TableCell>
                            <TableCell className={`text-right text-xs font-bold ${item.difference > 0 ? 'text-emerald-600' : item.difference < 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                              {formatDifference(item.difference)}
                            </TableCell>
                            <TableCell className={`text-right text-[10px] font-medium ${item.variationPercentage > 0 ? 'text-emerald-600' : item.variationPercentage < 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                              {formatPercent(item.variationPercentage)}
                            </TableCell>

                             <TableCell>
                              {item.status === "Contado" ? (
                                item.difference === 0 ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px] h-5">OK</Badge>
                                ) : item.difference > 0 ? (
                                  <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px] h-5">Sobra</Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-[10px] h-5">Falta</Badge>
                                )
                              ) : item.status === "Zerar" ? (
                                <Badge variant="destructive" className="text-[10px] h-5">Zerar</Badge>
                              ) : item.status === "Protegido" ? (
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-[10px] h-5">Protegido</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-[10px] h-5">Ignorado</Badge>
                              )}
                            </TableCell>

                            <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {item.action}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Tab: Notas Fiscais */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Notas Fiscais de Referência
                </CardTitle>
                <Select value={monthsBack} onValueChange={setMonthsBack}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Último mês</SelectItem>
                    <SelectItem value="3">Últimos 3 meses</SelectItem>
                    <SelectItem value="6">Últimos 6 meses</SelectItem>
                    <SelectItem value="12">Último ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingInvoices ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : invoiceData?.invoices?.length ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    {invoiceData.totalInvoices} nota(s) fiscal(is) importada(s) nos últimos {monthsBack} meses
                  </p>
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Número</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Data Importação</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceData.invoices.map((inv: any) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-mono">{inv.number}</TableCell>
                            <TableCell>{inv.issuer_name || "—"}</TableCell>
                            <TableCell>{new Date(inv.imported_at).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell className="text-right font-bold">
                              R$ {Number(inv.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="mb-4 h-10 w-10 opacity-30" />
                  <p className="text-sm">Nenhuma nota fiscal encontrada no período selecionado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info card */}
      <Card>
        <CardContent className="p-5">
          <p className="text-base font-semibold text-foreground mb-4">Como funciona o Balanço de Estoque</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">1</span>
              <p className="text-sm text-muted-foreground">Clique em <strong className="text-foreground">Iniciar Balanço</strong> para começar a contagem</p>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">2</span>
              <p className="text-sm text-muted-foreground">Use o <strong className="text-foreground">bip, câmera ou digitação</strong> para contar cada item</p>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">3</span>
              <p className="text-sm text-muted-foreground">Cada leitura <strong className="text-foreground">incrementa +1</strong> na contagem do produto</p>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">4</span>
              <p className="text-sm text-muted-foreground">Compare divergências e <strong className="text-foreground">exporte o relatório CSV</strong></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BalancoEstoque;
