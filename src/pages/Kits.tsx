import { useState } from "react";
import {
  Package, Plus, Trash2, Pencil, Copy, Loader2, Sparkles,
  ChevronDown, ChevronUp, ArrowRightLeft, Boxes
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useKits, useCreateKit, useUpdateKit, useDeleteKit, useDeductKitStock, useBulkCreateKits, type Kit, type KitFormData } from "@/hooks/useKitData";
import { useProducts } from "@/hooks/useProductData";
import { supabase } from "@/integrations/supabase/client";

const Kits = () => {
  const { toast } = useToast();
  const { data: kits, isLoading } = useKits();
  const { data: productsData } = useProducts({ pageSize: 500, sortBy: "name", sortOrder: "asc" });
  const products = productsData?.products || [];
  const createKit = useCreateKit();
  const updateKit = useUpdateKit();
  const deleteKit = useDeleteKit();
  const deductStock = useDeductKitStock();
  const bulkCreate = useBulkCreateKits();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [expandedKit, setExpandedKit] = useState<string | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveKit, setMoveKit] = useState<Kit | null>(null);
  const [moveQty, setMoveQty] = useState(1);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<KitFormData[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [search, setSearch] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [formItems, setFormItems] = useState<{ product_id: string; quantity: number }[]>([]);

  const generateSku = () => {
    const num = (kits?.length || 0) + 1;
    return `KIT-${String(num).padStart(3, "0")}`;
  };

  const resetForm = () => {
    setFormName(""); setFormSku(""); setFormDescription(""); setFormPrice(0); setFormActive(true); setFormItems([]);
    setEditingKit(null);
  };

  const openCreate = () => { resetForm(); setFormSku(generateSku()); setDialogOpen(true); };

  const openEdit = (kit: Kit) => {
    setEditingKit(kit);
    setFormName(kit.name);
    setFormSku(kit.sku);
    setFormDescription(kit.description || "");
    setFormPrice(kit.price);
    setFormActive(kit.active !== false);
    setFormItems(kit.kit_items?.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName || !formSku || formItems.length === 0) {
      toast({ title: "Preencha nome, SKU e adicione ao menos 1 produto.", variant: "destructive" });
      return;
    }
    const data: KitFormData = { name: formName, sku: formSku, description: formDescription, price: formPrice, items: formItems };
    if (editingKit) {
      await updateKit.mutateAsync({ id: editingKit.id, data });
    } else {
      await createKit.mutateAsync(data);
    }
    setDialogOpen(false);
    resetForm();
  };

  const addItem = () => setFormItems([...formItems, { product_id: "", quantity: 1 }]);
  const removeItem = (idx: number) => setFormItems(formItems.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: "product_id" | "quantity", value: string | number) => {
    setFormItems(formItems.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleMove = async () => {
    if (!moveKit) return;
    await deductStock.mutateAsync({ kitId: moveKit.id, quantity: moveQty, type: "physical_to_full" });
    setMoveDialogOpen(false);
    setMoveKit(null);
    setMoveQty(1);
  };

  const handleAiSuggest = async () => {
    if (products.length === 0) {
      toast({ title: "Cadastre produtos antes de solicitar sugestões de IA.", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const productList = products.slice(0, 50).map((p) => ({
        id: p.id, name: p.name, sku: p.sku, price: p.price, cost: p.cost,
        category: p.categories?.name || "Sem categoria",
        stock: p.stock_physical + p.stock_full,
      }));

      const { data, error } = await supabase.functions.invoke("ai-analysis", {
        body: {
          type: "kit-suggestion",
          prompt: `Analise estes produtos e sugira 3 kits que façam sentido comercial (combos, kits promocionais, kits complementares). Para cada kit, forneça: name (nome do kit), sku (sugestão de SKU), description (descrição curta), price (preço sugerido com desconto de kit), items (array com product_id e quantity). Produtos: ${JSON.stringify(productList)}. Responda APENAS em JSON válido no formato: [{ "name": "...", "sku": "...", "description": "...", "price": 0, "items": [{"product_id": "...", "quantity": 1}] }]`,
        },
      });

      if (error) throw error;

      const text = data?.analysis || data?.result || "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]) as KitFormData[];
        setAiSuggestions(suggestions);
      } else {
        toast({ title: "IA não retornou sugestões válidas. Tente novamente.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro na análise de IA", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleBulkCreate = async () => {
    try {
      const lines = bulkText.trim().split("\n").filter(Boolean);
      const kitsToCreate: KitFormData[] = lines.map((line, idx) => {
        const parts = line.split(";");
        return {
          name: parts[0]?.trim() || `Kit ${idx + 1}`,
          sku: parts[1]?.trim() || `KIT-${Date.now().toString(36).toUpperCase()}-${idx}`,
          description: parts[2]?.trim() || "",
          price: parseFloat(parts[3]?.trim() || "0") || 0,
          items: [],
        };
      });
      await bulkCreate.mutateAsync(kitsToCreate);
      setBulkDialogOpen(false);
      setBulkText("");
    } catch (err: any) {
      toast({ title: "Erro na criação em massa", description: err.message, variant: "destructive" });
    }
  };

  const filtered = (kits || []).filter((k) =>
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    k.sku.toLowerCase().includes(search.toLowerCase())
  );

  const getProductName = (id: string) => products.find((p) => p.id === id)?.name || id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" /> Kits de Produtos
          </h1>
          <p className="text-muted-foreground">Gerencie kits compostos por múltiplos produtos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)}>
            <Copy className="h-4 w-4 mr-1" /> Criar em Massa
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setAiSuggestions([]); setAiDialogOpen(true); }}>
            <Sparkles className="h-4 w-4 mr-1" /> Sugestão IA
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo Kit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-primary">{kits?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Total de Kits</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-primary">{kits?.filter((k) => k.active).length || 0}</div>
            <div className="text-sm text-muted-foreground">Kits Ativos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-muted-foreground">
              {kits?.reduce((sum, k) => sum + (k.kit_items?.length || 0), 0) || 0}
            </div>
            <div className="text-sm text-muted-foreground">Total de Componentes</div>
          </CardContent>
        </Card>
      </div>

      <Input
        placeholder="Buscar por nome ou SKU..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Boxes className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum kit cadastrado. Crie o primeiro!</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">Itens</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((kit) => (
                  <>
                    <TableRow key={kit.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedKit(expandedKit === kit.id ? null : kit.id)}>
                      <TableCell>
                        {expandedKit === kit.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-medium">{kit.name}</TableCell>
                      <TableCell className="font-mono text-xs">{kit.sku}</TableCell>
                      <TableCell className="text-center">{kit.kit_items?.length || 0}</TableCell>
                      <TableCell className="text-right">R$ {kit.price.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={kit.active ? "default" : "secondary"}>
                          {kit.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setMoveKit(kit); setMoveQty(1); setMoveDialogOpen(true); }}>
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(kit)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteKit.mutate(kit.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedKit === kit.id && kit.kit_items && kit.kit_items.length > 0 && (
                      <TableRow key={`${kit.id}-items`}>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          <div className="text-xs font-semibold mb-2 text-muted-foreground">Composição do Kit:</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {kit.kit_items.map((item) => (
                              <div key={item.id} className="flex items-center gap-2 bg-background rounded-lg p-2 border">
                                <Package className="h-4 w-4 text-primary shrink-0" />
                                <div className="text-sm flex-1 min-w-0 truncate">
                                  {item.products?.name || item.product_id}
                                </div>
                                <Badge variant="outline" className="shrink-0">{item.quantity}x</Badge>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingKit ? "Editar Kit" : "Novo Kit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome do kit *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Kit Combo Premium" />
              </div>
              <div>
                <Label>SKU do kit (auto)</Label>
                <Input value={formSku} onChange={(e) => setFormSku(e.target.value)} placeholder="KIT-001" className="font-mono" />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Descrição do kit..." rows={2} />
            </div>

            <Separator />

            {/* Products */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Produtos do Kit *</Label>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Produto
                </Button>
              </div>
              {formItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">Nenhum produto adicionado ao kit.</p>
              )}
              {formItems.map((item, idx) => {
                const selectedProduct = products.find(p => p.id === item.product_id);
                return (
                  <div key={idx} className="flex gap-2 items-center mb-2">
                    <Select value={item.product_id} onValueChange={(v) => updateItem(idx, "product_id", v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Buscar produto por nome ou SKU" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                    />
                    {selectedProduct && (
                      <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
                        R$ {(selectedProduct.cost * item.quantity).toFixed(2)}
                      </span>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* Pricing & Margin */}
            {(() => {
              const totalCost = formItems.reduce((sum, item) => {
                const p = products.find(pr => pr.id === item.product_id);
                return sum + (p ? p.cost * item.quantity : 0);
              }, 0);
              const margin = formPrice > 0 ? ((formPrice - totalCost) / formPrice * 100) : 0;
              return (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Custo calculado</Label>
                    <div className="h-10 flex items-center px-3 rounded-xl border border-border bg-muted/30 text-sm font-mono">
                      R$ {totalCost.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <Label>Preço de venda (R$)</Label>
                    <Input type="number" min={0} step={0.01} value={formPrice} onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label>Margem</Label>
                    <div className={`h-10 flex items-center px-3 rounded-xl border border-border text-sm font-bold ${
                      margin > 20 ? "text-emerald-400 bg-emerald-500/10" : margin > 0 ? "text-amber-400 bg-amber-500/10" : "text-destructive bg-destructive/10"
                    }`}>
                      {margin.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Active toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-muted/10">
              <div>
                <Label className="text-sm font-medium">Status do kit</Label>
                <p className="text-xs text-muted-foreground">{formActive ? "Ativo — disponível para venda" : "Inativo — não aparece nas listagens"}</p>
              </div>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createKit.isPending || updateKit.isPending}>
              {(createKit.isPending || updateKit.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingKit ? "Salvar" : "Salvar kit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Kit Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Kit para FULL</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Movimentar o kit <strong>{moveKit?.name}</strong> do estoque físico para FULL.
            Todos os itens do kit terão suas quantidades deduzidas proporcionalmente.
          </p>
          {moveKit?.kit_items && (
            <div className="space-y-1 text-sm border rounded-lg p-3 bg-muted/30">
              {moveKit.kit_items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.products?.name}</span>
                  <span className="font-mono">{item.quantity * moveQty}x</span>
                </div>
              ))}
            </div>
          )}
          <div>
            <Label>Quantidade de Kits</Label>
            <Input type="number" min={1} value={moveQty} onChange={(e) => setMoveQty(parseInt(e.target.value) || 1)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleMove} disabled={deductStock.isPending}>
              {deductStock.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Kits em Massa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Uma linha por kit. Formato: <code className="bg-muted px-1 rounded">Nome;SKU;Descrição;Preço</code>
          </p>
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Kit Combo A;KIT-A;Descrição;99.90\nKit Combo B;KIT-B;Descrição;149.90"}
            rows={6}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleBulkCreate} disabled={bulkCreate.isPending || !bulkText.trim()}>
              {bulkCreate.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Criar Kits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Suggestion Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Sugestões de Kits por IA
            </DialogTitle>
          </DialogHeader>
          {aiSuggestions.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                A IA analisará seus produtos e sugerirá kits que façam sentido comercial.
              </p>
              <Button onClick={handleAiSuggest} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                {aiLoading ? "Analisando..." : "Gerar Sugestões"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {aiSuggestions.map((suggestion, idx) => (
                <Card key={idx}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      {suggestion.name}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await createKit.mutateAsync(suggestion);
                          setAiSuggestions((prev) => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Criar
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p className="text-muted-foreground">{suggestion.description}</p>
                    <div className="flex gap-3">
                      <Badge variant="outline">SKU: {suggestion.sku}</Badge>
                      <Badge variant="outline">R$ {suggestion.price.toFixed(2)}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {suggestion.items.length} produto(s): {suggestion.items.map((i) => `${getProductName(i.product_id)} (${i.quantity}x)`).join(", ")}
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" className="w-full" onClick={() => { setAiSuggestions([]); handleAiSuggest(); }}>
                <Sparkles className="h-4 w-4 mr-1" /> Gerar Novas Sugestões
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Kits;
