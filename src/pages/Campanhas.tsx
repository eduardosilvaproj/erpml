import { useState, useCallback, useRef } from "react";
import {
  Megaphone, Upload, Sparkles, RefreshCw, Calendar, Trash2, Plus,
  Loader2, FileSpreadsheet, Save, Eye, Clock, Zap, ChevronDown,
  CheckCircle2, AlertCircle, LayoutTemplate
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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
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

export default function Campanhas() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [newCampaignName, setNewCampaignName] = useState("");
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

  const { data: campaigns, isLoading: loadingCampaigns } = useCampaigns();
  const { data: items } = useCampaignItems(selectedCampaignId);
  const createCampaign = useCreateCampaign();
  const addItems = useAddCampaignItems();
  const updateItem = useUpdateCampaignItem();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const { data: templates } = useCampaignTemplates();
  const createTemplate = useCreateTemplate();

  const selectedCampaign = campaigns?.find((c: any) => c.id === selectedCampaignId);
  const selectedTemplate = templates?.find((t: any) => t.id === selectedTemplateId);

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    const campaign = await createCampaign.mutateAsync(newCampaignName.trim());
    setSelectedCampaignId(campaign.id);
    setNewCampaignName("");
    setShowNewDialog(false);
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

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !templatePrompt.trim()) return;
    await createTemplate.mutateAsync({ name: templateName.trim(), description_prompt: templatePrompt.trim() });
    setTemplateName("");
    setTemplatePrompt("");
    setShowTemplateDialog(false);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
      rascunho: { variant: "secondary", label: "Rascunho" },
      processada: { variant: "outline", label: "Processada" },
      agendada: { variant: "default", label: "Agendada" },
      publicada: { variant: "default", label: "Publicada" },
    };
    const s = map[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const enrichedCount = items?.filter((i: any) => i.status === "enriquecido").length || 0;
  const pendingCount = items?.filter((i: any) => i.status === "pendente").length || 0;

  return (
    <div className="space-y-6">
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
                  <Textarea value={templatePrompt} onChange={(e) => setTemplatePrompt(e.target.value)} placeholder="Ex: Gere uma descrição vendável focada em benefícios, use linguagem persuasiva..." rows={4} />
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
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Campanha
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Campanha</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome da campanha</Label>
                  <Input value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} placeholder="Ex: Black Friday 2026" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateCampaign} disabled={!newCampaignName.trim() || createCampaign.isPending}>
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar: Campaign list */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Campanhas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[60vh] overflow-y-auto">
            {loadingCampaigns ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : campaigns?.length ? (
              campaigns.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCampaignId(c.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all text-sm ${
                    selectedCampaignId === c.id
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{c.name}</span>
                    {statusBadge(c.status)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {c.total_items} itens • {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma campanha</p>
            )}
          </CardContent>
        </Card>

        {/* Main content */}
        {selectedCampaignId && selectedCampaign ? (
          <div className="space-y-4">
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
                  <div className="rounded-lg bg-accent/50 p-2"><CheckCircle2 className="h-4 w-4 text-accent-foreground" /></div>
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
                <TabsTrigger value="preview">Pré-visualização ({items?.length || 0})</TabsTrigger>
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
                          <Upload className="mr-2 h-4 w-4" />
                          Upload
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
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Itens
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
                            <Sparkles className="mr-2 h-4 w-4" />
                            Enriquecer Todos ({pendingCount})
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
                    <CardTitle className="text-base">Itens da Campanha</CardTitle>
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
                                  <p className="text-xs text-muted-foreground line-clamp-3">
                                    {item.ai_description || "—"}
                                  </p>
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
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEnrichItem(item)}
                                    disabled={enrichingIds.has(item.id)}
                                  >
                                    {enrichingIds.has(item.id) ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-3 w-3" />
                                    )}
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
                        <Input
                          type="datetime-local"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                        />
                        <Button className="mt-2" variant="outline" onClick={handleSchedule} disabled={!scheduleDate}>
                          <Calendar className="mr-2 h-4 w-4" />
                          Agendar
                        </Button>
                      </div>
                      <div>
                        <Label>Ou publique agora</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Todos os itens enriquecidos serão publicados imediatamente
                        </p>
                        <Button onClick={handlePublish} disabled={enrichedCount === 0}>
                          <Megaphone className="mr-2 h-4 w-4" />
                          Publicar Agora
                        </Button>
                      </div>
                    </div>

                    {selectedCampaign?.scheduled_at && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-sm">
                          Agendada para: {new Date(selectedCampaign.scheduled_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Consumo de IA</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-primary/10 p-3">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{totalTokens.toLocaleString()} tokens utilizados</p>
                        <p className="text-xs text-muted-foreground">
                          Estimativa nesta sessão. O consumo real é debitado do seu saldo de créditos.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      deleteCampaign.mutate(selectedCampaignId!);
                      setSelectedCampaignId(null);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir Campanha
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
