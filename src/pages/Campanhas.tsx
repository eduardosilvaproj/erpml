import { useState, useCallback, useRef } from "react";
import {
  Megaphone, Upload, Sparkles, RefreshCw, Calendar, Trash2, Plus,
  Loader2, FileSpreadsheet, Save, Eye, Clock, Zap, ChevronDown,
  CheckCircle2, AlertCircle, LayoutTemplate, Pencil, Copy, Pause,
  XCircle, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useProducts } from "@/hooks/useProductData";
import {
  useCampaigns, useCampaignItems, useCreateCampaign, useAddCampaignItems,
  useUpdateCampaignItem, useUpdateCampaign, useDeleteCampaign,
  useCampaignTemplates, useCreateTemplate, enrichCampaignItem,
} from "@/hooks/useCampaignData";

function parseCSV(text: string): { product_name: string; price: number; quantity: number }[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(/[;,\t]/);
  const nameIdx = header.findIndex((h) => h.includes("nome") || h.includes("name") || h.includes("produto"));
  const priceIdx = header.findIndex((h) => h.includes("preco") || h.includes("preço") || h.includes("price"));
  const qtyIdx = header.findIndex((h) => h.includes("qtd") || h.includes("quantidade") || h.includes("quantity"));

  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split(/[;,\t]/);
    return {
      product_name: cols[nameIdx >= 0 ? nameIdx : 0]?.trim() || "",
      price: parseFloat(cols[priceIdx >= 0 ? priceIdx : 1]?.replace(",", ".") || "0") || 0,
      quantity: parseInt(cols[qtyIdx >= 0 ? qtyIdx : 2] || "1") || 1,
    };
  }).filter((i) => i.product_name);
}

const campaignStatusConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  rascunho: { label: "Rascunho", color: "text-muted-foreground", bgColor: "bg-muted/30", borderColor: "border-border/40" },
  processada: { label: "Processada", color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30" },
  agendada: { label: "Agendada", color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30" },
  publicada: { label: "Ativa", color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/30" },
  pausada: { label: "Pausada", color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30" },
  encerrada: { label: "Encerrada", color: "text-destructive", bgColor: "bg-destructive/10", borderColor: "border-destructive/30" },
};

export default function Campanhas() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templatePrompt, setTemplatePrompt] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [batchEnriching, setBatchEnriching] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [totalTokens, setTotalTokens] = useState(0);
  const [scheduleDate, setScheduleDate] = useState("");
  const [manualItems, setManualItems] = useState("");

  // New campaign form
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("desconto_produto");
  const [formDiscountMode, setFormDiscountMode] = useState<"percent" | "fixed">("percent");
  const [formDiscount, setFormDiscount] = useState(0);
  const [formChannel, setFormChannel] = useState("todos");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formActive, setFormActive] = useState(false);
  const [formProducts, setFormProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const { data: campaigns, isLoading: loadingCampaigns } = useCampaigns();
  const { data: items } = useCampaignItems(selectedCampaignId);
  const { data: productsData } = useProducts({ pageSize: 500, sortBy: "name", sortOrder: "asc" });
  const products = productsData?.products || [];
  const createCampaign = useCreateCampaign();
  const addItems = useAddCampaignItems();
  const updateItem = useUpdateCampaignItem();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const { data: templates } = useCampaignTemplates();
  const createTemplate = useCreateTemplate();

  const selectedCampaign = campaigns?.find((c: any) => c.id === selectedCampaignId);

  // Stats
  const totalCampaigns = campaigns?.length || 0;
  const activeCampaigns = campaigns?.filter((c: any) => c.status === "publicada").length || 0;
  const endedCampaigns = campaigns?.filter((c: any) => c.status === "encerrada").length || 0;

  const resetForm = () => {
    setFormName(""); setFormType("desconto_produto"); setFormDiscountMode("percent");
    setFormDiscount(0); setFormChannel("todos"); setFormStartDate(""); setFormEndDate("");
    setFormActive(false); setFormProducts([]); setProductSearch("");
  };

  const handleCreateCampaign = async () => {
    if (!formName.trim()) return;
    const campaign = await createCampaign.mutateAsync(formName.trim());
    if (formStartDate) {
      await updateCampaign.mutateAsync({
        id: campaign.id,
        data: {
          scheduled_at: new Date(formStartDate).toISOString(),
          status: formActive ? "publicada" : "rascunho",
        },
      });
    }
    setSelectedCampaignId(campaign.id);
    resetForm();
    setShowNewDialog(false);
  };

  const handleDuplicate = async (campaign: any) => {
    const dup = await createCampaign.mutateAsync(`${campaign.name} (cópia)`);
    toast({ title: `Campanha "${campaign.name}" duplicada!` });
    setSelectedCampaignId(dup.id);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCampaignId) return;
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length === 0) {
      toast({ title: "Nenhum item válido encontrado no arquivo", variant: "destructive" });
      return;
    }
    await addItems.mutateAsync({ campaignId: selectedCampaignId, items: parsed });
    toast({ title: `${parsed.length} itens importados!` });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedCampaignId, addItems, toast]);

  const handleManualAdd = async () => {
    if (!manualItems.trim() || !selectedCampaignId) return;
    const lines = manualItems.trim().split("\n").filter(Boolean);
    const parsed = lines.map((line) => {
      const parts = line.split(/[;,\t]/);
      return {
        product_name: parts[0]?.trim() || "",
        price: parseFloat(parts[1]?.replace(",", ".") || "0") || 0,
        quantity: parseInt(parts[2] || "1") || 1,
      };
    }).filter((i) => i.product_name);
    if (parsed.length === 0) return;
    await addItems.mutateAsync({ campaignId: selectedCampaignId, items: parsed });
    setManualItems("");
    toast({ title: `${parsed.length} itens adicionados!` });
  };

  const handleEnrichItem = async (item: any) => {
    const selectedTemplate = templates?.find((t: any) => t.id === selectedTemplateId);
    setEnrichingIds((prev) => new Set(prev).add(item.id));
    try {
      const { enriched, tokens } = await enrichCampaignItem(item.product_name, selectedTemplate?.description_prompt);
      await updateItem.mutateAsync({
        id: item.id,
        data: {
          ai_description: enriched.description,
          ai_category: enriched.category,
          ai_tags: enriched.tags || [],
          ai_specs: enriched.specs || {},
          status: "enriquecido",
          ai_cost_tokens: tokens,
        },
      });
      setTotalTokens((prev) => prev + tokens);
    } catch (err: any) {
      toast({ title: "Erro ao enriquecer", description: err.message, variant: "destructive" });
    } finally {
      setEnrichingIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  };

  const handleBatchEnrich = async () => {
    if (!items?.length) return;
    const pending = items.filter((i: any) => i.status === "pendente");
    if (pending.length === 0) {
      toast({ title: "Todos os itens já foram enriquecidos" });
      return;
    }
    setBatchEnriching(true);
    setBatchProgress({ current: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      setBatchProgress({ current: i + 1, total: pending.length });
      await handleEnrichItem(pending[i]);
      if (i < pending.length - 1) await new Promise((r) => setTimeout(r, 500));
    }
    setBatchEnriching(false);
    await updateCampaign.mutateAsync({
      id: selectedCampaignId!,
      data: { items_processed: pending.length, status: "processada" },
    });
    toast({ title: "Enriquecimento em lote concluído!" });
  };

  const handleSchedule = async () => {
    if (!scheduleDate || !selectedCampaignId) return;
    await updateCampaign.mutateAsync({
      id: selectedCampaignId,
      data: { scheduled_at: new Date(scheduleDate).toISOString(), status: "agendada" },
    });
    toast({ title: "Campanha agendada!" });
  };

  const handlePublish = async () => {
    if (!selectedCampaignId) return;
    await updateCampaign.mutateAsync({
      id: selectedCampaignId,
      data: { status: "publicada", published_at: new Date().toISOString() },
    });
    toast({ title: "Campanha publicada!" });
  };

  const handlePause = async () => {
    if (!selectedCampaignId) return;
    await updateCampaign.mutateAsync({
      id: selectedCampaignId,
      data: { status: "pausada" },
    });
    toast({ title: "Campanha pausada" });
  };

  const handleEnd = async () => {
    if (!selectedCampaignId) return;
    await updateCampaign.mutateAsync({
      id: selectedCampaignId,
      data: { status: "encerrada" },
    });
    toast({ title: "Campanha encerrada" });
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !templatePrompt.trim()) return;
    await createTemplate.mutateAsync({ name: templateName.trim(), description_prompt: templatePrompt.trim() });
    setTemplateName("");
    setTemplatePrompt("");
    setShowTemplateDialog(false);
  };

  const getStatusBadge = (status: string) => {
    const config = campaignStatusConfig[status] || campaignStatusConfig.rascunho;
    return (
      <Badge className={`${config.bgColor} ${config.color} border ${config.borderColor} text-[10px]`}>
        {config.label}
      </Badge>
    );
  };

  const enrichedCount = items?.filter((i: any) => i.status === "enriquecido").length || 0;
  const pendingCount = items?.filter((i: any) => i.status === "pendente").length || 0;

  const filteredProducts = products.filter(p =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10);

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campanhas em Massa</h1>
          <p className="text-muted-foreground">Crie e publique campanhas com IA</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <LayoutTemplate className="mr-2 h-4 w-4" />
                Templates
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Template de Descrição</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome do template</Label>
                  <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ex: Eletrônicos Premium" />
                </div>
                <div>
                  <Label>Prompt de descrição</Label>
                  <Textarea value={templatePrompt} onChange={(e) => setTemplatePrompt(e.target.value)} placeholder="Ex: Gere uma descrição vendável focada em benefícios..." rows={4} />
                </div>
                {templates && templates.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Templates existentes</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {templates.map((t: any) => (
                        <Badge key={t.id} variant="outline" className="text-xs">{t.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleSaveTemplate} disabled={!templateName.trim() || !templatePrompt.trim()}>
                  <Save className="mr-2 h-4 w-4" /> Salvar Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showNewDialog} onOpenChange={(open) => { setShowNewDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nova Campanha</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Campanha</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome da campanha *</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Black Friday 2026" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de campanha</Label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desconto_produto">Desconto em produto</SelectItem>
                        <SelectItem value="cupom">Cupom</SelectItem>
                        <SelectItem value="frete_gratis">Frete grátis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Canal</Label>
                    <Select value={formChannel} onValueChange={setFormChannel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pdv">PDV</SelectItem>
                        <SelectItem value="mercadolivre">Mercado Livre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formType !== "frete_gratis" && (
                  <div>
                    <Label>Desconto</Label>
                    <div className="flex gap-2 items-center">
                      <div className="flex border border-border rounded-lg overflow-hidden">
                        <button
                          className={`px-3 py-2 text-sm font-medium transition-colors ${formDiscountMode === "percent" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
                          onClick={() => setFormDiscountMode("percent")}
                        >%</button>
                        <button
                          className={`px-3 py-2 text-sm font-medium transition-colors ${formDiscountMode === "fixed" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
                          onClick={() => setFormDiscountMode("fixed")}
                        >R$</button>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step={formDiscountMode === "percent" ? 1 : 0.01}
                        value={formDiscount}
                        onChange={(e) => setFormDiscount(parseFloat(e.target.value) || 0)}
                        className="flex-1"
                        placeholder={formDiscountMode === "percent" ? "Ex: 15" : "Ex: 29.90"}
                      />
                    </div>
                  </div>
                )}

                <Separator />

                {/* Product search */}
                <div>
                  <Label>Produtos afetados</Label>
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar produto por nome ou SKU..."
                    className="mb-2"
                  />
                  {productSearch && filteredProducts.length > 0 && (
                    <div className="border border-border rounded-lg max-h-32 overflow-y-auto mb-2">
                      {filteredProducts.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (!formProducts.includes(p.id)) setFormProducts([...formProducts, p.id]);
                            setProductSearch("");
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex justify-between"
                        >
                          <span>{p.name}</span>
                          <span className="text-muted-foreground font-mono text-xs">{p.sku}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {formProducts.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {formProducts.map(pid => {
                        const p = products.find(pr => pr.id === pid);
                        return p ? (
                          <Badge key={pid} variant="secondary" className="gap-1">
                            {p.name}
                            <button onClick={() => setFormProducts(formProducts.filter(id => id !== pid))} className="ml-1 hover:text-destructive">×</button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data início</Label>
                    <Input type="datetime-local" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Data fim</Label>
                    <Input type="datetime-local" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-muted/10">
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <p className="text-xs text-muted-foreground">{formActive ? "Ativa — campanha ativa imediatamente" : "Rascunho — salva para edição futura"}</p>
                  </div>
                  <Switch checked={formActive} onCheckedChange={setFormActive} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowNewDialog(false); resetForm(); }}>Cancelar</Button>
                <Button onClick={handleCreateCampaign} disabled={!formName.trim() || createCampaign.isPending}>
                  {createCampaign.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Salvar campanha
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2"><BarChart3 className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total de campanhas</p>
              <p className="text-xl font-bold">{totalCampaigns}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2"><CheckCircle2 className="h-5 w-5 text-emerald-400" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Campanhas ativas</p>
              <p className="text-xl font-bold">{activeCampaigns}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-destructive/10 p-2"><XCircle className="h-5 w-5 text-destructive" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Encerradas</p>
              <p className="text-xl font-bold">{endedCampaigns}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Sidebar: Campaign list */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Campanhas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
            {loadingCampaigns ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : campaigns?.length ? (
              campaigns.map((c: any) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl transition-all text-sm border cursor-pointer ${
                    selectedCampaignId === c.id
                      ? "bg-primary/10 border-primary/30"
                      : "border-border/20 hover:bg-muted/30 hover:border-border/40"
                  }`}
                  onClick={() => setSelectedCampaignId(c.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium truncate flex-1 mr-2">{c.name}</span>
                    {getStatusBadge(c.status)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{c.total_items} produtos</span>
                    <span>•</span>
                    <span>{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                    {c.scheduled_at && (
                      <>
                        <span>→</span>
                        <span>{new Date(c.scheduled_at).toLocaleDateString("pt-BR")}</span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setSelectedCampaignId(c.id); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(c); }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma campanha</p>
            )}
          </CardContent>
        </Card>

        {/* Main content / Detail panel */}
        {selectedCampaignId && selectedCampaign ? (
          <div className="space-y-4">
            {/* Campaign detail header */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selectedCampaign.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(selectedCampaign.status)}
                      <span className="text-xs text-muted-foreground">
                        Criada em {new Date(selectedCampaign.created_at).toLocaleDateString("pt-BR")}
                      </span>
                      {selectedCampaign.scheduled_at && (
                        <span className="text-xs text-muted-foreground">
                          • Início: {new Date(selectedCampaign.scheduled_at).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedCampaign.status !== "publicada" && (
                      <Button size="sm" onClick={handlePublish} disabled={enrichedCount === 0}>
                        <Megaphone className="h-4 w-4 mr-1" /> Ativar
                      </Button>
                    )}
                    {selectedCampaign.status === "publicada" && (
                      <Button size="sm" variant="outline" onClick={handlePause}>
                        <Pause className="h-4 w-4 mr-1" /> Pausar
                      </Button>
                    )}
                    {selectedCampaign.status !== "encerrada" && (
                      <Button size="sm" variant="destructive" onClick={handleEnd}>
                        <XCircle className="h-4 w-4 mr-1" /> Encerrar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats bar */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2"><FileSpreadsheet className="h-4 w-4 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Itens</p>
                    <p className="text-lg font-bold">{items?.length || 0}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Enriquecidos</p>
                    <p className="text-lg font-bold">{enrichedCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-secondary p-2"><AlertCircle className="h-4 w-4 text-muted-foreground" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                    <p className="text-lg font-bold">{pendingCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2"><Zap className="h-4 w-4 text-primary" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tokens IA</p>
                    <p className="text-lg font-bold">{totalTokens.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {batchEnriching && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">Enriquecendo em lote...</span>
                    <span className="text-xs text-muted-foreground ml-auto">{batchProgress.current}/{batchProgress.total}</span>
                  </div>
                  <Progress value={(batchProgress.current / batchProgress.total) * 100} />
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="import">
              <TabsList>
                <TabsTrigger value="import">Importar</TabsTrigger>
                <TabsTrigger value="preview">Produtos ({items?.length || 0})</TabsTrigger>
                <TabsTrigger value="schedule">Agendamento</TabsTrigger>
              </TabsList>

              {/* Import Tab */}
              <TabsContent value="import" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Importar Produtos</CardTitle>
                    <CardDescription>Upload CSV/TXT ou cole os dados manualmente</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Upload de planilha (CSV)</Label>
                      <p className="text-xs text-muted-foreground mb-2">Colunas: nome/produto, preço, quantidade</p>
                      <div className="flex gap-2">
                        <Input ref={fileInputRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFileUpload} />
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="mr-2 h-4 w-4" /> Upload
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Ou cole manualmente (nome;preço;quantidade por linha)</Label>
                      <Textarea
                        value={manualItems}
                        onChange={(e) => setManualItems(e.target.value)}
                        placeholder={"Camiseta Preta;49.90;100\nTênis Running;199.90;50\nMochila Esportiva;89.90;75"}
                        rows={5}
                      />
                      <Button className="mt-2" size="sm" onClick={handleManualAdd} disabled={!manualItems.trim()}>
                        <Plus className="mr-2 h-4 w-4" /> Adicionar Itens
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {items && items.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">Enriquecimento com IA</CardTitle>
                          <CardDescription>Gere descrições, categorias e tags automaticamente</CardDescription>
                        </div>
                        <div className="flex gap-2 items-center">
                          {templates && templates.length > 0 && (
                            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Template padrão" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">Template padrão</SelectItem>
                                {templates.map((t: any) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Button onClick={handleBatchEnrich} disabled={batchEnriching || pendingCount === 0}>
                            <Sparkles className="mr-2 h-4 w-4" /> Enriquecer Todos ({pendingCount})
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                )}
              </TabsContent>

              {/* Preview Tab */}
              <TabsContent value="preview">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Produtos da Campanha</CardTitle>
                    <CardDescription>Revise e edite antes de publicar</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {items?.length ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produto</TableHead>
                              <TableHead>Preço</TableHead>
                              <TableHead>Qtd</TableHead>
                              <TableHead className="min-w-[250px]">Descrição IA</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead>Tags</TableHead>
                              <TableHead>Tokens</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium max-w-[150px] truncate">{item.product_name}</TableCell>
                                <TableCell>R$ {Number(item.price).toFixed(2)}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell className="max-w-[250px]">
                                  <p className="text-xs text-muted-foreground line-clamp-3">{item.ai_description || "—"}</p>
                                </TableCell>
                                <TableCell>
                                  {item.ai_category ? <Badge variant="outline" className="text-xs">{item.ai_category}</Badge> : "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {item.ai_tags?.slice(0, 3).map((tag: string, i: number) => (
                                      <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{item.ai_cost_tokens || 0}</TableCell>
                                <TableCell>
                                  <Badge variant={item.status === "enriquecido" ? "default" : "secondary"} className="text-xs">
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Button size="sm" variant="ghost" onClick={() => handleEnrichItem(item)} disabled={enrichingIds.has(item.id)}>
                                    {enrichingIds.has(item.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">Nenhum item. Importe produtos na aba anterior.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Schedule Tab */}
              <TabsContent value="schedule" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Agendamento e Publicação</CardTitle>
                    <CardDescription>Configure a data de publicação da campanha</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label>Data e hora de publicação</Label>
                        <Input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                        <Button className="mt-2" variant="outline" onClick={handleSchedule} disabled={!scheduleDate}>
                          <Calendar className="mr-2 h-4 w-4" /> Agendar
                        </Button>
                      </div>
                      <div>
                        <Label>Ou publique agora</Label>
                        <p className="text-xs text-muted-foreground mb-2">Todos os itens enriquecidos serão publicados imediatamente</p>
                        <Button onClick={handlePublish} disabled={enrichedCount === 0}>
                          <Megaphone className="mr-2 h-4 w-4" /> Publicar Agora
                        </Button>
                      </div>
                    </div>
                    {selectedCampaign?.scheduled_at && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-sm">Agendada para: {new Date(selectedCampaign.scheduled_at).toLocaleString("pt-BR")}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Consumo de IA</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-primary/10 p-3"><Zap className="h-5 w-5 text-primary" /></div>
                      <div>
                        <p className="font-medium">{totalTokens.toLocaleString()} tokens utilizados</p>
                        <p className="text-xs text-muted-foreground">Estimativa nesta sessão.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button variant="destructive" size="sm" onClick={() => { deleteCampaign.mutate(selectedCampaignId!); setSelectedCampaignId(null); }}>
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir Campanha
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Megaphone className="mb-4 h-12 w-12 opacity-30" />
              <p className="text-lg font-medium">Selecione ou crie uma campanha</p>
              <p className="text-sm">Use o botão "Nova Campanha" para começar</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
