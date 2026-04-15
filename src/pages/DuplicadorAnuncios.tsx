import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Copy, Search, Trash2, Plus, Send, Loader2, Package, Edit } from "lucide-react";
import { useMLApi } from "@/hooks/useMLData";
import { generateEAN13 } from "@/lib/ean13";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface VariationRow {
  id: string;
  attribute_name: string;
  attribute_value: string;
  sku: string;
  ean: string;
  quantity: number;
  price: number;
}

interface SourceItem {
  id: string;
  title: string;
  price: number;
  category_id: string;
  currency_id: string;
  buying_mode: string;
  condition: string;
  listing_type_id: string;
  available_quantity: number;
  pictures: { id?: string; url?: string; source?: string }[];
  attributes: any[];
  description?: string;
}

function generateSku(title: string, variation: string): string {
  const base = title
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);
  const suffix = variation
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);
  return `${base}-${suffix}`;
}

function generateUniqueEAN(existingEans: Set<string>): string {
  let ean = generateEAN13();
  let attempts = 0;
  while (existingEans.has(ean) && attempts < 100) {
    ean = generateEAN13();
    attempts++;
  }
  existingEans.add(ean);
  return ean;
}

export default function DuplicadorAnuncios() {
  const { callML } = useMLApi();

  const [itemId, setItemId] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sourceItem, setSourceItem] = useState<SourceItem | null>(null);

  const [attrName, setAttrName] = useState("Tamanho");
  const [attrValues, setAttrValues] = useState("");
  const [variations, setVariations] = useState<VariationRow[]>([]);

  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editDescription, setEditDescription] = useState("");

  // Step 1: Fetch source item
  const fetchItem = useCallback(async () => {
    const raw = itemId.trim().toUpperCase();
    // Extract MLB ID from full URL or raw input
    const match = raw.match(/(MLB[\d]+)/);
    const id = match ? match[1] : raw;
    if (!id || !/^MLB\d+$/i.test(id)) { toast.error("Informe um ID válido (ex: MLB1234567890)."); return; }
    setLoading(true);
    try {
      const data = await callML("get-item", { itemId: id });
      if (!data || !data.id) throw new Error("Anúncio não encontrado.");

      // fetch description using dedicated action
      let desc = "";
      try {
        const descData = await callML("get-item-description", { itemId: data.id });
        desc = descData?.plain_text || descData?.text || "";
      } catch { /* ignore */ }

      const item: SourceItem = {
        id: data.id,
        title: data.title || "",
        price: data.price || 0,
        category_id: data.category_id || "",
        currency_id: data.currency_id || "BRL",
        buying_mode: data.buying_mode || "buy_it_now",
        condition: data.condition || "new",
        listing_type_id: data.listing_type_id || "gold_special",
        available_quantity: data.available_quantity || 1,
        pictures: Array.isArray(data.pictures) ? data.pictures.map((p: any) => ({ source: p.secure_url || p.url })) : [],
        attributes: Array.isArray(data.attributes) ? data.attributes.filter((a: any) => !["SELLER_SKU", "GTIN", "SELLER_CUSTOM_FIELD"].includes(a.id)) : [],
        description: desc,
      };
      setSourceItem(item);
      setEditTitle(item.title);
      setEditPrice(item.price);
      setEditDescription(item.description || "");
      setVariations([]);
      toast.success("Anúncio carregado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar anúncio.");
    } finally {
      setLoading(false);
    }
  }, [itemId, callML]);

  // Step 2: Generate variations
  const generateVariations = useCallback(() => {
    const name = attrName.trim();
    if (!name) { toast.error("Informe o nome do atributo."); return; }
    const values = attrValues.split(",").map(v => v.trim()).filter(Boolean);
    if (values.length === 0) { toast.error("Informe ao menos um valor."); return; }

    const existingEans = new Set<string>(variations.map(v => v.ean));
    const newVars: VariationRow[] = values.map(value => ({
      id: crypto.randomUUID(),
      attribute_name: name,
      attribute_value: value,
      sku: generateSku(editTitle || "PROD", value),
      ean: generateUniqueEAN(existingEans),
      quantity: sourceItem?.available_quantity || 1,
      price: editPrice,
    }));

    setVariations(prev => [...prev, ...newVars]);
    setAttrValues("");
    toast.success(`${newVars.length} variações geradas!`);
  }, [attrName, attrValues, editTitle, editPrice, sourceItem, variations]);

  const removeVariation = (id: string) => {
    setVariations(prev => prev.filter(v => v.id !== id));
  };

  const updateVariation = (id: string, field: keyof VariationRow, value: any) => {
    setVariations(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  // Step 3: Publish
  const publishItem = useCallback(async () => {
    if (!sourceItem) return;
    if (variations.length === 0) { toast.error("Adicione ao menos uma variação."); return; }
    if (!editTitle.trim()) { toast.error("Título é obrigatório."); return; }

    setPublishing(true);
    try {
      const mlVariations = variations.map(v => ({
        attribute_combinations: [
          { id: v.attribute_name.toUpperCase().replace(/\s+/g, "_"), name: v.attribute_name, value_name: v.attribute_value },
        ],
        available_quantity: v.quantity,
        price: v.price,
        seller_custom_field: v.sku,
        attributes: [
          { id: "GTIN", value_name: v.ean },
          { id: "SELLER_SKU", value_name: v.sku },
        ],
        picture_ids: sourceItem.pictures.map((_, i) => `${sourceItem.id}-${String(i).padStart(3, "0")}`),
      }));

      const payload = {
        itemId: sourceItem.id,
        item: {
          title: editTitle.trim(),
          category_id: sourceItem.category_id,
          price: editPrice,
          currency_id: sourceItem.currency_id,
          buying_mode: sourceItem.buying_mode,
          condition: sourceItem.condition,
          listing_type_id: sourceItem.listing_type_id,
          pictures: sourceItem.pictures,
          attributes: sourceItem.attributes,
          description: editDescription,
          variations: mlVariations,
        },
      };

      const result = await callML("duplicate-item", payload);
      toast.success(`Anúncio criado com sucesso! ID: ${result.id}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao publicar anúncio.");
    } finally {
      setPublishing(false);
    }
  }, [sourceItem, variations, editTitle, editPrice, editDescription, callML]);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Copy className="h-6 w-6 text-primary" />
          Duplicador de Anúncios com Variações
        </h1>
        <p className="text-muted-foreground mt-1">
          Duplique um anúncio do Mercado Livre adicionando variações automaticamente.
        </p>
      </div>

      {/* Step 1 - Load Item */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full h-6 w-6 flex items-center justify-center p-0">1</Badge>
            Buscar Anúncio Original
          </CardTitle>
          <CardDescription>Informe o ID do anúncio que deseja duplicar (ex: MLB1234567890)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="MLB1234567890"
              value={itemId}
              onChange={e => setItemId(e.target.value.toUpperCase())}
              className="max-w-xs"
              onKeyDown={e => e.key === "Enter" && fetchItem()}
            />
            <Button onClick={fetchItem} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              Buscar
            </Button>
          </div>

          {sourceItem && (
            <div className="mt-4 p-4 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-medium">{sourceItem.title}</span>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>ID: {sourceItem.id}</span>
                <span>Preço: R$ {sourceItem.price.toFixed(2)}</span>
                <span>Fotos: {sourceItem.pictures.length}</span>
                <span>Categoria: {sourceItem.category_id}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {sourceItem && (
        <>
          {/* Step 1.5 - Edit details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Editar Dados do Novo Anúncio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título (máx 60 caracteres)</Label>
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value.slice(0, 60))} maxLength={60} />
                <span className="text-xs text-muted-foreground">{editTitle.length}/60</span>
              </div>
              <div>
                <Label>Preço Base (R$)</Label>
                <Input type="number" min={0} step={0.01} value={editPrice} onChange={e => setEditPrice(Number(e.target.value))} className="max-w-[200px]" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea rows={4} value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Descrição do produto..." />
              </div>
            </CardContent>
          </Card>

          {/* Step 2 - Add Variations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full h-6 w-6 flex items-center justify-center p-0">2</Badge>
                Definir Variações
              </CardTitle>
              <CardDescription>Adicione atributos e seus valores separados por vírgula</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <Label>Atributo</Label>
                  <Input value={attrName} onChange={e => setAttrName(e.target.value)} placeholder="Tamanho" className="w-[160px]" />
                </div>
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label>Valores (separados por vírgula)</Label>
                  <Input value={attrValues} onChange={e => setAttrValues(e.target.value)} placeholder="38, 40, 42, 44" onKeyDown={e => e.key === "Enter" && generateVariations()} />
                </div>
                <Button onClick={generateVariations} variant="secondary">
                  <Plus className="h-4 w-4 mr-1" /> Gerar
                </Button>
              </div>

              {variations.length > 0 && (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atributo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>EAN-13</TableHead>
                        <TableHead className="w-[80px]">Qtd</TableHead>
                        <TableHead className="w-[100px]">Preço</TableHead>
                        <TableHead className="w-[50px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variations.map(v => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.attribute_name}</TableCell>
                          <TableCell>
                            <Input value={v.attribute_value} onChange={e => updateVariation(v.id, "attribute_value", e.target.value)} className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Input value={v.sku} onChange={e => updateVariation(v.id, "sku", e.target.value)} className="h-8 font-mono text-xs" />
                          </TableCell>
                          <TableCell>
                            <Input value={v.ean} onChange={e => updateVariation(v.id, "ean", e.target.value)} className="h-8 font-mono text-xs" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={1} value={v.quantity} onChange={e => updateVariation(v.id, "quantity", Number(e.target.value))} className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} step={0.01} value={v.price} onChange={e => updateVariation(v.id, "price", Number(e.target.value))} className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => removeVariation(v.id)} className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3 - Publish */}
          {variations.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full h-6 w-6 flex items-center justify-center p-0">3</Badge>
                  Publicar Novo Anúncio
                </CardTitle>
                <CardDescription>Revise as variações acima antes de publicar</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    <strong>{variations.length}</strong> variações • Título: <strong>{editTitle}</strong>
                  </div>
                  <Button onClick={publishItem} disabled={publishing} className="ml-auto">
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Publicar no Mercado Livre
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
