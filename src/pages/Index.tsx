import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Package, Warehouse, TrendingUp, ArrowUpRight, ArrowDownRight,
  DollarSign, Percent, Truck, Send, UserPlus,
  ShoppingCart, Target, Store, PackageOpen, Monitor, ScanLine, PlusCircle, ScanBarcode,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useDashboardData, type PeriodFilter } from "@/hooks/useDashboardData";
import { useMLDashboardMetrics } from "@/hooks/useMLDashboardMetrics";
import { useMLConnection } from "@/hooks/useMLData";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { useBarcodeSearch } from "@/hooks/useBarcodeSearch";
import { BarcodeSearchDialogs } from "@/components/barcode/BarcodeSearchDialogs";
import { useToast } from "@/hooks/use-toast";
import { MLSalesSection } from "@/components/dashboard/MLSalesSection";

const PERIOD_DAYS: Record<PeriodFilter, number> = {
  today: 1,
  "7d": 7,
  "14d": 14,
  "15d": 15,
  "30d": 30,
  "39d": 39,
  "6m": 180,
  "1a": 365,
};

const periodLabels: Record<PeriodFilter, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "14d": "14 dias",
  "15d": "15 dias",
  "30d": "30 dias",
  "39d": "39 dias",
  "6m": "6 meses",
  "1a": "1 ano",
};

const quickAccessSections = [
  { id: "cadastros", title: "Cadastros", desc: "Produtos, kits, equipe e CRM", icon: Package, url: "/produtos", tooltip: "Clique para gerenciar produtos, kits, equipe e clientes" },
  { id: "estoque", title: "Estoque", desc: "Saldos, notas e conferência", icon: Warehouse, url: "/estoque", tooltip: "Clique para ver e controlar seu estoque físico e FULL" },
  { id: "vendas", title: "Vendas", desc: "PDV, campanhas e integrações", icon: Store, url: "/pdv", tooltip: "Clique para acessar o PDV, campanhas e integrações" },
  { id: "gestao", title: "Gestão", desc: "Relatórios e financeiro", icon: TrendingUp, url: "/painel-hub", tooltip: "Clique para ver relatórios e configurações da empresa" },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function TrendBadge({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value === 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
      — Sem variação
    </span>
  );
  const isUp = value > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      isUp ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
    }`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? "+" : ""}{value}{suffix}
    </span>
  );
}

const metricTooltips: Record<string, string> = {
  "Vendas": "Total de vendas realizadas no período selecionado",
  "Receita Bruta": "Valor total das vendas antes de descontar custos",
  "Lucro Líquido": "O que sobra depois de pagar todos os custos",
  "Ticket Médio": "Valor médio gasto por cliente em cada compra",
  "Margem": "Porcentagem de lucro sobre o valor de venda",
  "Pendentes": "Pedidos que ainda não foram enviados ao cliente",
  "Enviados": "Pedidos que já foram despachados",
  "Novos Clientes": "Clientes que compraram pela primeira vez",
};

function MetricCard({ icon: Icon, label, value, trend, iconColor }: {
  icon: any; label: string; value: string; trend?: number; iconColor: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="hover-lift border-border/50">
          <CardContent className="px-3 py-2 lg:px-5 lg:py-3">
            <div className="flex items-center gap-1.5 lg:gap-2">
              <Icon className={`h-3.5 w-3.5 lg:h-4 lg:w-4 ${iconColor}`} strokeWidth={1.75} />
              <span className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</span>
            </div>
            <p className="text-xl lg:text-3xl font-bold text-foreground leading-none mt-2 lg:mt-3 truncate">{value}</p>
            <div className="mt-2 lg:mt-3">
              {trend !== undefined && <TrendBadge value={trend} />}
            </div>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent>{metricTooltips[label] || label}</TooltipContent>
    </Tooltip>
  );
}

const quickActions = [
  { id: "entrada", title: "Entrada de Mercadoria", desc: "Receber produtos com NF", icon: PackageOpen, color: "text-emerald-400", borderColor: "border-l-[#34D399]", hoverBg: "hover:bg-emerald-500/5", route: "/entrada-nota", tooltip: "Recebi produtos novos e quero dar entrada no estoque" },
  { id: "venda", title: "Nova Venda", desc: "Abrir PDV e registrar venda", icon: Monitor, color: "text-sky-400", borderColor: "border-l-[#60A5FA]", hoverBg: "hover:bg-sky-500/5", route: "/pdv", tooltip: "Quero registrar uma venda agora no balcão" },
  { id: "conferencia", title: "Conferência", desc: "Bipar e conferir estoque", icon: ScanLine, color: "text-amber-400", borderColor: "border-l-[#FBBF24]", hoverBg: "hover:bg-amber-500/5", route: "/conferencia", tooltip: "Quero verificar se o estoque físico está correto" },
  { id: "novo-produto", title: "Novo Produto", desc: "Cadastrar produto no catálogo", icon: PlusCircle, color: "text-violet-400", borderColor: "border-l-[#A78BFA]", hoverBg: "hover:bg-violet-500/5", route: null, tooltip: "Quero cadastrar um produto novo no sistema" },
];

const Index = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const periodDays = PERIOD_DAYS[period] ?? 30;
  const { data: mlConnection } = useMLConnection();
  const { metrics: mlMetrics } = useMLDashboardMetrics(periodDays);
  const { data, isLoading } = useDashboardData(period, mlConnection ? {
    grossRevenue: mlMetrics.grossRevenue,
    totalFees: mlMetrics.totalFees,
    totalShipping: mlMetrics.totalShipping,
    netRevenue: mlMetrics.netRevenue,
    totalOrders: mlMetrics.totalOrders,
  } : undefined);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [newProductBarcode, setNewProductBarcode] = useState<string | null>(null);
  const navigate = useNavigate();
  const barcodeSearch = useBarcodeSearch();

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Period Filter */}
      <div className="flex items-center justify-end gap-1 lg:gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="h-7 lg:h-8 w-7 lg:w-8 rounded-full"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
            queryClient.invalidateQueries({ queryKey: ["ml-persisted-orders"] });
            queryClient.invalidateQueries({ queryKey: ["ml-orders"] });
            queryClient.invalidateQueries({ queryKey: ["ml-metrics"] });
          }}
          title="Atualizar dados"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        {(Object.keys(periodLabels) as PeriodFilter[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`text-[11px] lg:text-xs font-medium h-7 lg:h-8 px-3 lg:px-4 rounded-full border transition-all ${
              period === p
                ? "bg-foreground text-background border-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Bipagem Rápida */}
      <Card className="bg-primary/5 border-primary/20 shadow-sm">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ScanBarcode className="h-4 w-4 text-primary" />
            Bipar Produto (EAN/SKU)
          </CardTitle>
        </CardHeader>
        <CardContent className="py-0 px-4 pb-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <BarcodeScannerInput
                value={barcodeInput}
                onChange={setBarcodeInput}
                onScan={(code) => {
                  barcodeSearch.handleSearch(code, (result) => {
                    toast({ title: `Produto encontrado: ${result.produto.name}` });
                    // Optionally navigate or open edit
                    navigate(`/produtos?search=${code}`);
                  });
                }}
                placeholder="Escaneie ou digite o código do item..."
                inputClassName="h-10 text-sm font-mono"
                showCameraButton
              />
            </div>
            <Button 
              size="sm" 
              className="h-10 px-4"
              onClick={() => barcodeSearch.handleSearch(barcodeInput, (result) => {
                toast({ title: `Produto encontrado: ${result.produto.name}` });
                navigate(`/produtos?search=${barcodeInput}`);
              })}
              disabled={!barcodeInput.trim()}
            >
              Bipar
            </Button>
          </div>
        </CardContent>
      </Card>

      <MLSalesSection period={period} />

      <BarcodeSearchDialogs
        notFoundOpen={barcodeSearch.notFoundOpen}
        setNotFoundOpen={barcodeSearch.setNotFoundOpen}
        boxDetectedOpen={barcodeSearch.boxDetectedOpen}
        setBoxDetectedOpen={barcodeSearch.setBoxDetectedOpen}
        codigo={barcodeSearch.lastCodigo}
        produto={barcodeSearch.lastResult?.produto}
        boxQty={barcodeSearch.lastResult?.qty}
        onConfirmBox={(qty) => {
          navigate(`/produtos?search=${barcodeSearch.lastCodigo}`);
        }}
        onRegisterGtin={() => {
          setNewProductBarcode(barcodeSearch.lastCodigo);
          setShowNewProduct(true);
        }}
        onRegisterProduct={() => {
          setNewProductBarcode(barcodeSearch.lastCodigo);
          setShowNewProduct(true);
        }}
        onLinkProduct={() => {
          navigate("/produtos");
        }}
      />

      <ProductFormDialog 
        open={showNewProduct} 
        onOpenChange={setShowNewProduct} 
        product={newProductBarcode ? { barcode: newProductBarcode } as any : null}
        onSuccess={() => {
          setNewProductBarcode(null);
          setBarcodeInput("");
        }}
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}><CardContent className="p-3 lg:p-5"><Skeleton className="h-16 lg:h-20 w-full" /></CardContent></Card>
            ))}
          </div>
        </div>
      ) : data ? (
        <>
          {/* Primary KPIs - row 1 */}
          <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={ShoppingCart} label="Vendas" value={String(data.totalSales)} trend={data.salesTrend} iconColor="text-primary" />
            <MetricCard icon={DollarSign} label="Receita Total" value={formatCurrency(data.consolidatedRevenue)} trend={data.consolidatedRevenueTrend} iconColor="text-success" />
            <MetricCard icon={TrendingUp} label="Lucro Líquido" value={formatCurrency(data.netProfit)} trend={parseFloat(data.profitMargin.toFixed(1))} iconColor="text-warning" />
            <MetricCard icon={Target} label="Ticket Médio" value={formatCurrency(data.avgTicket)} trend={data.avgTicketTrend} iconColor="text-primary" />
          </div>

          {/* Secondary KPIs - row 2 */}
          <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Percent} label="Margem" value={`${data.profitMargin.toFixed(1)}%`} iconColor="text-warning" />
            <MetricCard icon={Truck} label="Pendentes" value={String(data.pendingShipments)} iconColor="text-destructive" />
            <MetricCard icon={Send} label="Enviados" value={String(data.sentShipments)} iconColor="text-success" />
            <MetricCard icon={UserPlus} label="Novos Clientes" value={String(data.newCustomers)} trend={data.newCustomersTrend} iconColor="text-primary" />
          </div>

          {/* Revenue Breakdown - PDV vs ML */}
          <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/50 bg-muted/20">
              <CardContent className="px-3 py-2 lg:px-5 lg:py-3">
                <span className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita PDV</span>
                <p className="text-lg lg:text-2xl font-bold text-foreground leading-none mt-1">{formatCurrency(data.revenue)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-muted/20">
              <CardContent className="px-3 py-2 lg:px-5 lg:py-3">
                <span className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita ML</span>
                <p className="text-lg lg:text-2xl font-bold text-foreground leading-none mt-1">{formatCurrency(data.mlRevenue)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-muted/20">
              <CardContent className="px-3 py-2 lg:px-5 lg:py-3">
                <span className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider">Taxas ML</span>
                <p className="text-lg lg:text-2xl font-bold text-destructive leading-none mt-1">{formatCurrency(data.mlFees)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-muted/20">
              <CardContent className="px-3 py-2 lg:px-5 lg:py-3">
                <span className="text-[10px] lg:text-xs font-medium text-muted-foreground uppercase tracking-wider">Pedidos ML</span>
                <p className="text-lg lg:text-2xl font-bold text-foreground leading-none mt-1">{data.mlOrders}</p>
              </CardContent>
            </Card>
          </div>

          {/* Ações Rápidas */}
          <div>
            <div className="mb-3 lg:mb-4">
              <h2 className="text-sm lg:text-base font-semibold text-foreground">Ações Rápidas</h2>
              <p className="text-[10px] lg:text-xs text-muted-foreground/60 mt-0.5">Suas tarefas mais frequentes</p>
            </div>
            <div className="grid gap-2 lg:gap-3 grid-cols-2 lg:grid-cols-4">
              {quickActions.map((action) => (
                <Tooltip key={action.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => action.route ? navigate(action.route) : setShowNewProduct(true)}
                      className={`flex items-center gap-2 lg:gap-4 p-2 lg:p-5 min-h-[60px] lg:min-h-[80px] rounded-xl border border-border/30 border-l-[3px] ${action.borderColor} bg-muted/30 backdrop-blur transition-all duration-150 ${action.hoverBg} hover:scale-[1.02] text-left group cursor-pointer`}
                    >
                      <div className={`shrink-0 rounded-lg bg-background/60 p-1.5 lg:p-2.5 ${action.color}`}>
                        <action.icon className="h-4 w-4 lg:h-6 lg:w-6" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] lg:text-base font-semibold text-foreground truncate">{action.title}</p>
                        <p className="text-[10px] lg:text-sm text-muted-foreground truncate">{action.desc}</p>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{action.tooltip}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Divisor */}
          <div className="border-t border-border/30" />

          {/* Quick Access */}
          <div>
            <h2 className="text-xs lg:text-sm font-semibold text-foreground mb-3 lg:mb-4">Acesso Rápido</h2>
            <div className="grid gap-3 lg:gap-4 grid-cols-2 lg:grid-cols-4">
              {quickAccessSections.map((sec) => (
                <Tooltip key={sec.id}>
                  <TooltipTrigger asChild>
                    <Link to={sec.url}>
                      <Card className="hover-lift cursor-pointer group border-border/40 bg-card/60 hover:border-primary/30 transition-all h-[100px] lg:h-[130px]">
                        <CardContent className="p-3 lg:p-4 flex flex-col items-center justify-center text-center gap-1.5 lg:gap-2 h-full">
                          <div className="rounded-xl bg-primary/10 p-2 lg:p-2.5 group-hover:bg-primary/15 transition-colors">
                            <sec.icon className="h-6 w-6 lg:h-10 lg:w-10 text-primary" strokeWidth={1.5} />
                          </div>
                          <div className="min-w-0 w-full">
                            <p className="font-semibold text-foreground text-[11px] lg:text-base truncate">{sec.title}</p>
                            <p className="text-[10px] lg:text-sm text-muted-foreground truncate">{sec.desc}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>{sec.tooltip}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* Original dialog removed because it's now wrapped in the barcode logic above */}
    </div>
  );
};

export default Index;
