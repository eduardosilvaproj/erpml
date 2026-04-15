import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCategories, useCreateProduct, useUpdateProduct, type Product, type ProductFormData } from "@/hooks/useProductData";
import { Loader2, Sparkles, Camera, AlertTriangle, Wand2, Search, Check, RefreshCw } from "lucide-react";
import { enrichProduct } from "@/lib/enrich-product";
import { useToast } from "@/hooks/use-toast";
import { generateEAN13, isValidEAN13 } from "@/lib/ean13";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { supabase } from "@/integrations/supabase/client";

type UnsplashPhoto = {
  id: string;
  url_small: string;
  url_regular: string;
  alt: string;
  photographer: string;
};

const schema = z.object({
  sku: z.string().min(1, "SKU obrigatório").max(50),
  barcode: z.string().max(50).optional().or(z.literal("")),
  name: z.string().min(1, "Nome obrigatório").max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  category_id: z.string().optional().or(z.literal("")),
  cost: z.coerce.number().min(0, "Custo inválido"),
  price: z.coerce.number().min(0, "Preço inválido"),
  weight: z.coerce.number().min(0).optional().or(z.literal("")),
  width: z.coerce.number().min(0).optional().or(z.literal("")),
  height: z.coerce.number().min(0).optional().or(z.literal("")),
  depth: z.coerce.number().min(0).optional().or(z.literal("")),
  sku_ml: z.string().max(50).optional().or(z.literal("")),
  id_ml: z.string().max(50).optional().or(z.literal("")),
  min_stock: z.coerce.number().int().min(0).optional(),
  stock_initial: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

function generateAlternativeSku(baseSku: string): string {
  const match = baseSku.match(/^(.+?)[-_]?(\d+)$/);
  if (match) {
    const num = parseInt(match[2], 10) + 1;
    return `${match[1]}-${String(num).padStart(match[2].length, "0")}`;
  }
  return `${baseSku}-2`;
}

function generateRandomSku(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "SKU-";
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  const { toast } = useToast();
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [isEnriching, setIsEnriching] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [skuConflict, setSkuConflict] = useState<{ suggestedSku: string; pendingValues: FormValues } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [unsplashPhotos, setUnsplashPhotos] = useState<UnsplashPhoto[]>([]);
  const [isSearchingPhotos, setIsSearchingPhotos] = useState(false);
  const [showPhotoGrid, setShowPhotoGrid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const [photoSource, setPhotoSource] = useState<"file" | "unsplash" | null>(null);

  const getDefaults = (p?: Product | null): FormValues => ({
    sku: p?.sku || "",
    barcode: p?.barcode || "",
    name: p?.name || "",
    description: p?.description || "",
    category_id: p?.category_id || "",
    cost: p?.cost || 0,
    price: p?.price || 0,
    weight: p?.weight ?? "",
    width: p?.width ?? "",
    height: p?.height ?? "",
    depth: p?.depth ?? "",
    sku_ml: p?.sku_ml || "",
    id_ml: p?.id_ml || "",
    min_stock: p?.min_stock || 0,
    stock_initial: 0,
    active: p?.active ?? true,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: getDefaults(product),
  });

  useEffect(() => {
    if (open) {
      form.reset(getDefaults(product));
      setSkuConflict(null);
      setPhotoPreview(product?.image_url || null);
      setUnsplashPhotos([]);
      setShowPhotoGrid(false);
      selectedFileRef.current = null;
      setPhotoSource(product?.image_url ? "unsplash" : null);
    }
  }, [open, product]);

  const isLoading = createProduct.isPending || updateProduct.isPending;

  const costVal = form.watch("cost");
  const priceVal = form.watch("price");
  const margin = typeof costVal === "number" && costVal > 0 && typeof priceVal === "number" && priceVal > 0
    ? (((priceVal - costVal) / costVal) * 100).toFixed(1)
    : null;

  const checkSkuExists = async (sku: string, excludeId?: string): Promise<boolean> => {
    let query = supabase.from("products").select("id").eq("sku", sku).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query;
    return (data && data.length > 0) || false;
  };

  const uploadImageToStorage = async (sku: string): Promise<string | null> => {
    // Upload from file
    if (photoSource === "file" && selectedFileRef.current) {
      const file = selectedFileRef.current;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${sku}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      return urlData.publicUrl;
    }
    // Download from Unsplash URL and upload
    if (photoSource === "unsplash" && photoPreview && photoPreview.startsWith("http")) {
      try {
        const res = await fetch(photoPreview);
        const blob = await res.blob();
        const path = `${sku}-${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        return urlData.publicUrl;
      } catch {
        return photoPreview; // fallback to direct URL
      }
    }
    return null;
  };

  const submitProduct = async (values: FormValues) => {
    let imageUrl: string | null = product?.image_url || null;
    
    // Only upload if photo changed
    if (photoSource) {
      try {
        const uploaded = await uploadImageToStorage(values.sku);
        if (uploaded) imageUrl = uploaded;
      } catch (err: any) {
        toast({ title: "Erro ao salvar foto", description: err.message, variant: "destructive" });
      }
    }

    const formData: ProductFormData = {
      sku: values.sku,
      barcode: values.barcode || undefined,
      name: values.name,
      description: values.description || undefined,
      category_id: values.category_id || undefined,
      cost: values.cost,
      price: values.price,
      weight: typeof values.weight === "number" ? values.weight : undefined,
      width: typeof values.width === "number" ? values.width : undefined,
      height: typeof values.height === "number" ? values.height : undefined,
      depth: typeof values.depth === "number" ? values.depth : undefined,
      sku_ml: values.sku_ml || undefined,
      id_ml: values.id_ml || undefined,
      min_stock: values.min_stock,
      supplier_ids: [],
      image_url: imageUrl || undefined,
    };

    if (product) {
      await updateProduct.mutateAsync({ id: product.id, data: formData });
    } else {
      await createProduct.mutateAsync(formData);
    }
    onOpenChange(false);
    form.reset();
  };

  const onSubmit = async (values: FormValues) => {
    const exists = await checkSkuExists(values.sku, product?.id);
    if (exists) {
      const suggested = generateAlternativeSku(values.sku);
      setSkuConflict({ suggestedSku: suggested, pendingValues: values });
      return;
    }
    await submitProduct(values);
  };

  const handleUseSuggestedSku = async () => {
    if (!skuConflict) return;
    const newValues = { ...skuConflict.pendingValues, sku: skuConflict.suggestedSku };
    form.setValue("sku", skuConflict.suggestedSku);
    setSkuConflict(null);
    await submitProduct(newValues);
  };

  const handleEditSkuManually = () => {
    if (!skuConflict) return;
    setSkuConflict(null);
    form.setFocus("sku");
  };

  const handleEnrich = async () => {
    const name = form.getValues("name");
    if (!name) {
      toast({ title: "Informe o nome do produto primeiro", variant: "destructive" });
      return;
    }
    setIsEnriching(true);
    try {
      const data = await enrichProduct({ productName: name, ean: form.getValues("barcode") || undefined });
      if (data.description && !form.getValues("description")) form.setValue("description", data.description);
      if (data.weight_kg != null && !form.getValues("weight")) form.setValue("weight", data.weight_kg);
      if (data.width_cm != null && !form.getValues("width")) form.setValue("width", data.width_cm);
      if (data.height_cm != null && !form.getValues("height")) form.setValue("height", data.height_cm);
      if (data.depth_cm != null && !form.getValues("depth")) form.setValue("depth", data.depth_cm);
      if (data.suggested_price_brl != null && form.getValues("price") === 0) form.setValue("price", data.suggested_price_brl);
      if (data.suggested_category && !form.getValues("category_id") && categories) {
        const match = categories.find((c) => c.name.toLowerCase() === data.suggested_category!.toLowerCase());
        if (match) form.setValue("category_id", match.id);
      }
      toast({ title: "Dados preenchidos com IA!", description: "Revise os campos antes de salvar." });
    } catch (err: any) {
      toast({ title: "Erro ao buscar dados", description: err.message, variant: "destructive" });
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSearchPhotos = async () => {
    const name = form.getValues("name");
    if (!name || name.trim().length === 0) {
      toast({ title: "Digite o nome do produto primeiro", variant: "destructive" });
      return;
    }
    setIsSearchingPhotos(true);
    setShowPhotoGrid(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unsplash-search?query=${encodeURIComponent(name.trim())}&per_page=6`;
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token || ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro na busca");
      setUnsplashPhotos(result.photos || []);
    } catch (err: any) {
      toast({ title: "Erro ao buscar fotos", description: err.message, variant: "destructive" });
      setUnsplashPhotos([]);
    } finally {
      setIsSearchingPhotos(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      selectedFileRef.current = file;
      setPhotoSource("file");
      setPhotoPreview(URL.createObjectURL(file));
      setShowPhotoGrid(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>{product ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] px-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pb-2">
                {/* Photo upload */}
                <div className="space-y-3">
                  <div
                    className="relative border-2 border-dashed border-border/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith("image/")) {
                        selectedFileRef.current = file;
                        setPhotoSource("file");
                        setPhotoPreview(URL.createObjectURL(file));
                        setShowPhotoGrid(false);
                      }
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="h-24 w-24 object-cover rounded-lg" />
                    ) : (
                      <>
                        <Camera className="h-8 w-8 text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">Clique ou arraste uma foto</p>
                        <p className="text-xs text-muted-foreground/50">JPG, PNG ou WEBP</p>
                      </>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleSearchPhotos}
                    disabled={isSearchingPhotos}
                  >
                    {isSearchingPhotos ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    ✨ Buscar foto automaticamente
                  </Button>

                  {showPhotoGrid && (
                    <div className="space-y-2">
                      {isSearchingPhotos ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : unsplashPhotos.length > 0 ? (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            {unsplashPhotos.map((photo) => (
                              <button
                                key={photo.id}
                                type="button"
                                className={`relative rounded-lg overflow-hidden aspect-square border-2 transition-all hover:border-primary/60 ${
                                  photoPreview === photo.url_regular
                                    ? "border-primary ring-2 ring-primary/30"
                                    : "border-border/30"
                                }`}
                                onClick={() => {
                                  setPhotoPreview(photo.url_regular);
                                  setPhotoSource("unsplash");
                                  selectedFileRef.current = null;
                                }}
                              >
                                <img
                                  src={photo.url_small}
                                  alt={photo.alt}
                                  className="w-full h-full object-cover"
                                />
                                {photoPreview === photo.url_regular && (
                                  <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                                    <Check className="h-3 w-3 text-primary-foreground" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={handleSearchPhotos}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Buscar novamente
                          </Button>
                          <p className="text-[10px] text-muted-foreground/50 text-center">Fotos via Unsplash</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhuma foto encontrada. Tente outro termo.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Name */}
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do produto *</FormLabel>
                    <FormControl><Input {...field} placeholder="Nome do produto" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* AI Enrich */}
                <Button type="button" variant="outline" size="sm" onClick={handleEnrich} disabled={isEnriching} className="w-full">
                  {isEnriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {isEnriching ? "Buscando dados com IA..." : "Preencher com IA"}
                </Button>

                {/* SKU + Barcode */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="sku" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código SKU *</FormLabel>
                      <div className="flex gap-2">
                        <FormControl><Input {...field} placeholder="SKU-001" /></FormControl>
                        <Button type="button" variant="outline" size="icon" title="Gerar automaticamente" onClick={() => form.setValue("sku", generateRandomSku())}>
                          <Wand2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="barcode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de Barras</FormLabel>
                      <div className="flex gap-2">
                        <FormControl><Input {...field} placeholder="7891234567890" /></FormControl>
                        <Button type="button" variant="outline" size="icon" title="Escanear" onClick={() => setShowScanner((v) => !v)}>
                          <Camera className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" title="Gerar EAN-13" onClick={() => { const ean = generateEAN13(); form.setValue("barcode", ean); toast({ title: "EAN-13 gerado!", description: ean }); }}>
                          <Wand2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {field.value && field.value.length === 13 && (
                        <p className={`text-xs ${isValidEAN13(field.value) ? "text-emerald-500" : "text-destructive"}`}>
                          {isValidEAN13(field.value) ? "✓ EAN-13 válido" : "✗ EAN-13 inválido"}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {showScanner && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Escanear código de barras</p>
                    <BarcodeScanner onScan={(code) => { form.setValue("barcode", code); setShowScanner(false); toast({ title: "Código escaneado!", description: code }); }} />
                  </div>
                )}

                {/* Category */}
                <FormField control={form.control} name="category_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Description */}
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl><Textarea {...field} placeholder="Descrição do produto" rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Pricing + Margin */}
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="cost" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço de custo (R$)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço de venda (R$) *</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Margem de lucro</label>
                    <Input
                      value={margin ? `${margin}%` : "—"}
                      readOnly
                      className="bg-muted/30 cursor-default"
                    />
                  </div>
                </div>

                {/* Stock */}
                <div className="grid grid-cols-2 gap-4">
                  {!product && (
                    <FormField control={form.control} name="stock_initial" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estoque inicial</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  )}
                  <FormField control={form.control} name="min_stock" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estoque mínimo (alerta)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-4 gap-4">
                  <FormField control={form.control} name="weight" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peso (kg)</FormLabel>
                      <FormControl><Input type="number" step="0.001" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="width" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Largura (cm)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="height" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Altura (cm)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="depth" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prof. (cm)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* ML fields */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="sku_ml" render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU ML</FormLabel>
                      <FormControl><Input {...field} placeholder="SKU Mercado Livre" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="id_ml" render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID ML</FormLabel>
                      <FormControl><Input {...field} placeholder="MLB123456" /></FormControl>
                    </FormItem>
                  )} />
                </div>

                {/* Status */}
                <FormField control={form.control} name="active" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-sm font-medium">Status do produto</FormLabel>
                      <p className="text-xs text-muted-foreground">{field.value ? "Ativo — visível no catálogo" : "Inativo — oculto do catálogo"}</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />

                {/* Footer */}
                <DialogFooter className="pt-4 border-t border-border/40">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar produto
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* SKU Duplicate Modal */}
      <Dialog open={!!skuConflict} onOpenChange={(v) => { if (!v) setSkuConflict(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              SKU Duplicado
            </DialogTitle>
            <DialogDescription>
              Já existe um produto com o SKU <strong className="text-foreground">{skuConflict?.pendingValues.sku}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/50 p-3 text-center">
            <p className="text-sm text-muted-foreground">SKU sugerido:</p>
            <p className="text-lg font-semibold">{skuConflict?.suggestedSku}</p>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleEditSkuManually}>Editar manualmente</Button>
            <Button onClick={handleUseSuggestedSku}>Usar sugerido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
