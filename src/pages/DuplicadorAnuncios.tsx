import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Copy, Search, Trash2, Plus, Send, Loader2, Package, Edit,
  ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Image,
} from "lucide-react";
import { useMLApi, useMLConnection } from "@/hooks/useMLData";
import { supabase } from "@/integrations/supabase/client";
import { generateEAN13 } from "@/lib/ean13";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ── Types ──────────────────────────────────────────────

interface VariationRow {
  id: string;
  combo: Record<string, string>; // e.g. { SIZE: "38", COLOR: "Azul" }
  comboLabel: string;
  sku: string;
  ean: string;
  quantity: number;
  price: number;
  active: boolean;
}

interface AttrGroup {
  id: string;
  name: string;        // display name, e.g. "Tamanho"
  mlId: string;        // ML attribute id, e.g. "SIZE"
  values: string[];    // e.g. ["38","40","42"]
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
  pictures: { id?: string; url?: string; source?: string; secure_url?: string }[];
  attributes: any[];
  variations?: any[];
  description?: string;
  thumbnail?: string;
  permalink?: string;
  _seller_nickname?: string;
  _seller_id?: number;
  _is_own_item?: boolean;
  _connected_nickname?: string;
}

// ── Helpers ────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function generateSku(title: string, parts: string[]): string {
  const base = slugify(title).slice(0, 8);
  const suffix = parts.map(p => slugify(p).slice(0, 6)).join("-");
  return `${base}-${suffix}`;
}

function generateUniqueEAN(existingEans: Set<string>): string {
  let ean = generateEAN13();
  let attempts = 0;
  while (existingEans.has(ean) && attempts < 200) {
    ean = generateEAN13();
    attempts++;
  }
  existingEans.add(ean);
  return ean;
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function serializeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  try {
    return JSON.parse(JSON.stringify(error));
  } catch {
    return { value: String(error) };
  }
}

/** Cartesian product of attribute value arrays */
function cartesian(groups: AttrGroup[]): Record<string, string>[] {
  if (groups.length === 0) return [];
  return groups.reduce<Record<string, string>[]>((acc, group) => {
    if (acc.length === 0) {
      return group.values.map(v => ({ [group.mlId]: v }));
    }
    const result: Record<string, string>[] = [];
    for (const existing of acc) {
      for (const v of group.values) {
        result.push({ ...existing, [group.mlId]: v });
      }
    }
    return result;
  }, []);
}

// Known ML variation attributes
const ML_VARIATION_ATTRS: { mlId: string; name: string }[] = [
  { mlId: "SIZE", name: "Tamanho" },
  { mlId: "COLOR", name: "Cor" },
  { mlId: "ALPHANUMERIC_SIZE", name: "Tamanho Alfanumérico" },
  { mlId: "SHOE_SIZE", name: "Tamanho de Calçado" },
  { mlId: "WAIST_SIZE", name: "Tamanho de Cintura" },
  { mlId: "LENGTH", name: "Comprimento" },
  { mlId: "WEIGHT", name: "Peso" },
  { mlId: "VOLTAGE", name: "Voltagem" },
  { mlId: "CAPACITY", name: "Capacidade" },
  { mlId: "FLAVOR", name: "Sabor" },
];

// ── Component ──────────────────────────────────────────

export default function DuplicadorAnuncios() {
  const { callML } = useMLApi();
  const { data: mlConnection } = useMLConnection();

  const [step, setStep] = useState(1);

  // Step 1 state
  const [itemIdInput, setItemIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [testingProxy, setTestingProxy] = useState(false);
  const [sourceItem, setSourceItem] = useState<SourceItem | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Step 2 state
  const [attrGroups, setAttrGroups] = useState<AttrGroup[]>([]);
  const [newAttrMlId, setNewAttrMlId] = useState("");
  const [newAttrValues, setNewAttrValues] = useState("");

  // Step 3 state
  const [variations, setVariations] = useState<VariationRow[]>([]);
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editDescription, setEditDescription] = useState("");

  // Step 4 state
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ id: string; permalink: string } | null>(null);

  // ── Step 1: Fetch ────────────────────────────────────

  const fetchItem = useCallback(async () => {
    const raw = itemIdInput.trim().toUpperCase();
    const match = raw.match(/(MLB[\d]+)/);
    const id = match ? match[1] : raw;
    if (!id || !/^MLB\d+$/i.test(id)) {
      toast.error("Informe um ID válido (ex: MLB1234567890).");
      return;
    }

    setLoading(true);
    setDebugError(null);
    try {
      console.log("[Duplicador] Chamando Edge Function ml-proxy com itemId:", id);
      const { data, error } = await supabase.functions.invoke("ml-proxy", {
        body: { itemId: id },
      });
      console.log("[Duplicador] Resposta da Edge Function ml-proxy:", data, error);

      if (error) {
        setDebugError(safeStringify({
          source: "invoke",
          error: serializeUnknownError(error),
        }));
        throw new Error(error.message || "Erro ao chamar proxy de anúncios.");
      }

      if (data?.error) {
        setDebugError(safeStringify({
          source: "ml-proxy",
          status: data?.status ?? null,
          message: data?.message ?? null,
          error: data?.error ?? null,
          cause: data?.cause ?? null,
          error_type: data?.error_type ?? null,
          blocked_by: data?.blocked_by ?? null,
          attempts: data?.attempts ?? null,
          details: data?.details ?? null,
        }));
        throw new Error(data.error || data.message || "Erro ao buscar anúncio");
      }

      if (!data || typeof data !== "object" || !data.id) {
        setDebugError(safeStringify({ source: "ml-proxy", data }));
        throw new Error("Anúncio não encontrado ou resposta inválida.");
      }

      setDebugError(safeStringify({
        source: "ml-proxy",
        status: 200,
        itemId: data.id,
        title: data.title,
      }));

      console.log("[Duplicador] Item loaded:", data.id, data.title);

      let desc = "";
      try {
        const descData = await callML<any>("get-item-description", { itemId: data.id });
        desc = descData?.plain_text || descData?.text || "";
      } catch (descErr) {
        console.warn("[Duplicador] Descrição não carregada:", descErr);
      }

      const safePictures = Array.isArray(data.pictures)
        ? data.pictures
            .map((p: any) => ({
              source: p?.secure_url || p?.url,
              secure_url: p?.secure_url || p?.url,
            }))
            .filter((p: any) => !!p.secure_url)
        : [];

      const item: SourceItem = {
        id: String(data.id),
        title: data.title || "",
        price: Number(data.price) || 0,
        category_id: data.category_id || "",
        currency_id: data.currency_id || "BRL",
        buying_mode: data.buying_mode || "buy_it_now",
        condition: data.condition || "new",
        listing_type_id: data.listing_type_id || "gold_special",
        available_quantity: Number(data.available_quantity) || 1,
        pictures: safePictures,
        attributes: Array.isArray(data.attributes)
          ? data.attributes.filter(
              (a: any) => a && !["SELLER_SKU", "GTIN", "SELLER_CUSTOM_FIELD"].includes(a.id)
            )
          : [],
        variations: Array.isArray(data.variations) ? data.variations : [],
        description: desc,
        thumbnail: typeof data.thumbnail === "string"
          ? data.thumbnail
          : (typeof data.secure_thumbnail === "string" ? data.secure_thumbnail : ""),
        permalink: data.permalink,
        _seller_nickname: data._seller_nickname || null,
        _seller_id: data._seller_id || null,
        _is_own_item: data._is_own_item || false,
        _connected_nickname: data._connected_nickname || null,
      };

      setSourceItem(item);
      setEditTitle(item.title);
      setEditPrice(item.price);
      setEditDescription(item.description || "");
      setAttrGroups([]);
      setVariations([]);
      setStep(2);
      toast.success("Anúncio carregado com sucesso!");
    } catch (err: any) {
      console.error("[Duplicador] Erro ao buscar anúncio:", err);
      if (!debugError) {
        setDebugError(safeStringify({
          source: "catch",
          error: serializeUnknownError(err),
        }));
      }
      toast.error(err?.message || "Erro ao buscar anúncio.");
      setSourceItem(null);
    } finally {
      setLoading(false);
    }
  }, [itemIdInput, callML, debugError]);

  const handleTestConnection = useCallback(async () => {
    const testItemId = "MLB3552891495";
    setTestingProxy(true);
    setTestResult("Testando conexão...");

    console.log("[Duplicador] Chamando Edge Function ml-proxy com itemId fixo:", testItemId);

    try {
      const { data, error } = await supabase.functions.invoke("ml-proxy", {
        body: { itemId: testItemId },
      });

      console.log("[Duplicador] Resposta da Edge Function (teste):", data, error);
      setTestResult(safeStringify({
        itemId: testItemId,
        data,
        error: error ? serializeUnknownError(error) : null,
      }));
    } catch (invokeError) {
      console.error("[Duplicador] Erro ao chamar Edge Function (teste):", invokeError);
      setTestResult(safeStringify({
        itemId: testItemId,
        error: serializeUnknownError(invokeError),
      }));
    } finally {
      setTestingProxy(false);
    }
  }, []);

  // ── Step 2: Attribute management ─────────────────────

  const availableAttrs = useMemo(() => {
    const usedIds = new Set(attrGroups.map(g => g.mlId));
    return ML_VARIATION_ATTRS.filter(a => !usedIds.has(a.mlId));
  }, [attrGroups]);

  const addAttrGroup = useCallback(() => {
    if (!newAttrMlId) {
      toast.error("Selecione um atributo.");
      return;
    }
    const values = newAttrValues
      .split(",")
      .map(v => v.trim())
      .filter(Boolean);
    if (values.length === 0) {
      toast.error("Informe ao menos um valor.");
      return;
    }
    const attr = ML_VARIATION_ATTRS.find(a => a.mlId === newAttrMlId);
    if (!attr) return;

    setAttrGroups(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: attr.name,
        mlId: attr.mlId,
        values,
      },
    ]);
    setNewAttrMlId("");
    setNewAttrValues("");
    toast.success(`Atributo "${attr.name}" adicionado com ${values.length} valores.`);
  }, [newAttrMlId, newAttrValues]);

  const removeAttrGroup = (id: string) => {
    setAttrGroups(prev => prev.filter(g => g.id !== id));
  };

  const variationPreviewCount = useMemo(() => {
    if (attrGroups.length === 0) return 0;
    return attrGroups.reduce((acc, g) => acc * g.values.length, 1);
  }, [attrGroups]);

  const buildVariations = useCallback(() => {
    if (attrGroups.length === 0) {
      toast.error("Adicione ao menos um atributo.");
      return;
    }

    const combos = cartesian(attrGroups);
    const existingEans = new Set<string>();
    const attrNameMap = Object.fromEntries(attrGroups.map(g => [g.mlId, g.name]));

    const rows: VariationRow[] = combos.map(combo => {
      const parts = attrGroups.map(g => combo[g.mlId]);
      const comboLabel = attrGroups
        .map(g => `${g.name} ${combo[g.mlId]}`)
        .join(" / ");

      return {
        id: crypto.randomUUID(),
        combo,
        comboLabel,
        sku: generateSku(editTitle || "PROD", parts),
        ean: generateUniqueEAN(existingEans),
        quantity: 0,
        price: editPrice,
        active: true,
      };
    });

    setVariations(rows);
    setStep(3);
    toast.success(`${rows.length} variações geradas!`);
  }, [attrGroups, editTitle, editPrice]);

  // ── Step 3: Edit variations ──────────────────────────

  const updateVariation = (id: string, field: keyof VariationRow, value: any) => {
    setVariations(prev => prev.map(v => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const removeVariation = (id: string) => {
    setVariations(prev => prev.filter(v => v.id !== id));
  };

  // ── Step 4: Publish ──────────────────────────────────

  const publishItem = useCallback(async () => {
    if (!sourceItem) return;
    const activeVars = variations.filter(v => v.active);
    if (activeVars.length === 0) {
      toast.error("Ative ao menos uma variação.");
      return;
    }
    if (!editTitle.trim()) {
      toast.error("Título é obrigatório.");
      return;
    }

    setPublishing(true);
    try {
      const mlVariations = activeVars.map(v => ({
        attribute_combinations: Object.entries(v.combo).map(([mlId, value]) => ({
          id: mlId,
          value_name: value,
        })),
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

      console.log("[Duplicador] Publishing payload:", JSON.stringify(payload, null, 2));
      const result = await callML("duplicate-item", payload);
      console.log("[Duplicador] Publish result:", result);

      setPublishResult({
        id: result.id,
        permalink: result.permalink || `https://www.mercadolivre.com.br/p/${result.id}`,
      });
      toast.success("Anúncio publicado com sucesso!");
    } catch (err: any) {
      console.error("[Duplicador] Erro ao publicar:", err);
      toast.error(err.message || "Erro ao publicar anúncio.");
    } finally {
      setPublishing(false);
    }
  }, [sourceItem, variations, editTitle, editPrice, editDescription, callML]);

  const resetAll = () => {
    setStep(1);
    setSourceItem(null);
    setItemIdInput("");
    setAttrGroups([]);
    setVariations([]);
    setPublishResult(null);
  };

  // ── Render ───────────────────────────────────────────

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
        {mlConnection && (
          <p className="text-xs text-muted-foreground mt-1">
            Conta conectada: <strong>{mlConnection.seller_nickname || mlConnection.ml_user_id}</strong>
          </p>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`rounded-full h-7 w-7 flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                s === step
                  ? "border-primary bg-primary text-primary-foreground"
                  : s < step
                  ? "border-primary/50 bg-primary/20 text-primary"
                  : "border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              {s < step ? "✓" : s}
            </div>
            <span className={`hidden sm:inline ${s === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {s === 1 ? "Buscar" : s === 2 ? "Variações" : s === 3 ? "Revisar" : "Publicar"}
            </span>
            {s < 4 && <Separator className="w-6" />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Search ────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full h-6 w-6 flex items-center justify-center p-0 text-xs">1</Badge>
              Buscar Anúncio Original
            </CardTitle>
            <CardDescription>
              Informe o ID ou cole a URL do anúncio que deseja duplicar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="MLB1234567890 ou URL do anúncio"
                value={itemIdInput}
                onChange={e => setItemIdInput(e.target.value.toUpperCase())}
                className="max-w-md"
                onKeyDown={e => e.key === "Enter" && fetchItem()}
              />
              <Button onClick={fetchItem} disabled={loading || testingProxy}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Buscar
              </Button>
              <Button variant="secondary" onClick={handleTestConnection} disabled={loading || testingProxy}>
                {testingProxy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Package className="h-4 w-4 mr-1" />}
                Testar conexão
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              ℹ️ Certifique-se de ter os direitos sobre as imagens e conteúdo utilizados.
            </p>

            {!mlConnection && (
              <p className="text-sm text-destructive mt-3">
                Nenhuma conta do Mercado Livre conectada. Vá em Integrações para conectar.
              </p>
            )}

            {debugError && (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-muted/30 p-3">
                <p className="text-sm font-medium text-destructive">Debug da busca</p>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-foreground">
                  {debugError}
                </pre>
              </div>
            )}

            {testResult && (
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium text-foreground">Resultado do teste da Edge Function</p>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-foreground">
                  {testResult}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2: Define variations ─────────────────── */}
      {step === 2 && sourceItem && (
        <>
          {/* Item preview */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-4 items-start">
                {typeof sourceItem.thumbnail === "string" && sourceItem.thumbnail.length > 0 && (
                  <img
                    src={sourceItem.thumbnail.replace("http://", "https://")}
                    alt={sourceItem.title || "Anúncio"}
                    className="w-24 h-24 object-contain rounded-lg border bg-white flex-shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2">{sourceItem.title}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>ID: {sourceItem.id}</span>
                    <span>Preço: R$ {sourceItem.price.toFixed(2)}</span>
                    <span>Fotos: {sourceItem.pictures.length}</span>
                    <span>Cat: {sourceItem.category_id}</span>
                    {sourceItem._seller_nickname && (
                      <span>Vendedor: {sourceItem._seller_nickname}</span>
                    )}
                  </div>

                  {/* Seller badge */}
                  {sourceItem._is_own_item ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium">
                      ✅ Seu anúncio — será duplicado com novas variações
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-medium">
                      📋 Anúncio de outro vendedor — você irá criar uma cópia na sua conta
                    </div>
                  )}

                  {sourceItem.permalink && (
                    <a
                      href={sourceItem.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Ver no ML <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Existing variations */}
              {sourceItem.variations && sourceItem.variations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Variações existentes ({sourceItem.variations.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {sourceItem.variations.slice(0, 12).map((v: any, i: number) => {
                      const label = Array.isArray(v.attribute_combinations)
                        ? v.attribute_combinations.map((a: any) => a.value_name).join(" / ")
                        : `Variação ${i + 1}`;
                      return <Badge key={i} variant="outline" className="text-xs">{label}</Badge>;
                    })}
                    {sourceItem.variations.length > 12 && (
                      <Badge variant="outline" className="text-xs">+{sourceItem.variations.length - 12}</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Key attributes */}
              {sourceItem.attributes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Atributos ({sourceItem.attributes.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {sourceItem.attributes.slice(0, 8).map((a: any, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {a.name}: {a.value_name || "—"}
                      </Badge>
                    ))}
                    {sourceItem.attributes.length > 8 && (
                      <Badge variant="secondary" className="text-xs">+{sourceItem.attributes.length - 8}</Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Dados do Novo Anúncio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título (máx 60 caracteres)</Label>
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value.slice(0, 60))}
                  maxLength={60}
                />
                <span className="text-xs text-muted-foreground">{editTitle.length}/60</span>
              </div>
              <div>
                <Label>Preço Base (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editPrice}
                  onChange={e => setEditPrice(Number(e.target.value))}
                  className="max-w-[200px]"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  rows={3}
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Descrição do produto..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Attribute groups */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full h-6 w-6 flex items-center justify-center p-0 text-xs">2</Badge>
                Atributos de Variação
              </CardTitle>
              <CardDescription>
                Adicione atributos e valores para gerar variações automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing groups */}
              {attrGroups.map(g => (
                <div key={g.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1">
                    <span className="font-medium text-sm">{g.name}</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {g.values.map(v => (
                        <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeAttrGroup(g.id)}
                    className="h-8 w-8 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Add new attribute */}
              {availableAttrs.length > 0 && (
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1">
                    <Label>Atributo</Label>
                    <select
                      value={newAttrMlId}
                      onChange={e => setNewAttrMlId(e.target.value)}
                      className="flex h-10 w-[180px] items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Selecione...</option>
                      {availableAttrs.map(a => (
                        <option key={a.mlId} value={a.mlId}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 flex-1 min-w-[200px]">
                    <Label>Valores (separados por vírgula)</Label>
                    <Input
                      value={newAttrValues}
                      onChange={e => setNewAttrValues(e.target.value)}
                      placeholder="38, 40, 42, 44"
                      onKeyDown={e => e.key === "Enter" && addAttrGroup()}
                    />
                  </div>
                  <Button onClick={addAttrGroup} variant="secondary">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>
              )}

              {/* Preview count */}
              {variationPreviewCount > 0 && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                  Serão geradas <strong>{variationPreviewCount}</strong> variações
                  {attrGroups.length > 1 && (
                    <span className="text-muted-foreground">
                      {" "}({attrGroups.map(g => `${g.values.length} ${g.name.toLowerCase()}`).join(" × ")})
                    </span>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <Button onClick={buildVariations} disabled={attrGroups.length === 0}>
                  Gerar Variações <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── STEP 3: Review & Edit ─────────────────────── */}
      {step === 3 && sourceItem && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full h-6 w-6 flex items-center justify-center p-0 text-xs">3</Badge>
              Revisar e Editar Variações
            </CardTitle>
            <CardDescription>
              Revise SKU, EAN, preço e estoque de cada variação antes de publicar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Variação</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>EAN-13</TableHead>
                    <TableHead className="w-[80px]">Estoque</TableHead>
                    <TableHead className="w-[100px]">Preço</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variations.map(v => (
                    <TableRow key={v.id} className={!v.active ? "opacity-40" : ""}>
                      <TableCell>
                        <Switch
                          checked={v.active}
                          onCheckedChange={val => updateVariation(v.id, "active", val)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-xs whitespace-nowrap">
                        {v.comboLabel}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={v.sku}
                          onChange={e => updateVariation(v.id, "sku", e.target.value)}
                          className="h-8 font-mono text-xs w-[140px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={v.ean}
                          onChange={e => updateVariation(v.id, "ean", e.target.value)}
                          className="h-8 font-mono text-xs w-[140px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={v.quantity}
                          onChange={e => updateVariation(v.id, "quantity", Number(e.target.value))}
                          className="h-8 w-[70px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={v.price}
                          onChange={e => updateVariation(v.id, "price", Number(e.target.value))}
                          className="h-8 w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeVariation(v.id)}
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="text-sm text-muted-foreground">
              <strong>{variations.filter(v => v.active).length}</strong> de {variations.length} variações ativas
              {" • "}Título: <strong>{editTitle}</strong>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={publishItem}
                disabled={publishing || variations.filter(v => v.active).length === 0}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
                {publishing ? "Publicando no ML..." : "✓ Publicar Anúncio"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Success Modal ─────────────────────────────── */}
      <Dialog open={!!publishResult} onOpenChange={open => !open && resetAll()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-500">
              <CheckCircle2 className="h-6 w-6" />
              Anúncio Publicado com Sucesso!
            </DialogTitle>
            <DialogDescription>
              Seu anúncio com variações foi criado no Mercado Livre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              ID do novo anúncio: <strong className="font-mono">{publishResult?.id}</strong>
            </p>
            {publishResult?.permalink && (
              <a
                href={publishResult.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Ver anúncio no Mercado Livre <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <div className="pt-2">
              <Button onClick={resetAll} className="w-full">
                Duplicar outro anúncio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
