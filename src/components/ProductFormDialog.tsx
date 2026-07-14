import { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Loader2, Sparkles, Camera, AlertTriangle, Wand2, Search, Check, RefreshCw, Plus, Trash2, Dices, Lock, Unlock, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { enrichProduct } from "@/lib/enrich-product";
import { useToast } from "@/hooks/use-toast";
import { generateEAN13, generateGenericEAN13, isValidEAN13 } from "@/lib/ean13";

import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { supabase } from "@/integrations/supabase/client";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useCompanyId } from "@/hooks/useCompanyId";

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
  ean: z.string().max(50).optional().or(z.literal("")),
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
  gtin_cx: z.string().max(50).optional().or(z.literal("")),
  box_quantity: z.coerce.number().int().min(0).optional().or(z.literal("")),
  supplier_skus: z.array(z.object({
    supplier_name: z.string().min(1, "Nome obrigatório"),
    supplier_sku: z.string().min(1, "SKU obrigatório"),
  })).optional(),
});

type FormValues = z.infer<typeof schema>;

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSuccess?: (newProduct: any) => void;
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

export function ProductFormDialog({ open, onOpenChange, product, onSuccess }: ProductFormDialogProps) {
  const { toast } = useToast();
  const cid = useCompanyId();
  const { data: categories } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [isEnriching, setIsEnriching] = useState(false);
  const [showGtinCxScanner, setShowGtinCxScanner] = useState(false);
  const { guardedClose, showConfirm, confirmDiscard, confirmContinue, markDirty, resetDirty } = useUnsavedChanges(onOpenChange);
  const [skuConflict, setSkuConflict] = useState<{ suggestedSku: string; pendingValues: FormValues } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [unsplashPhotos, setUnsplashPhotos] = useState<UnsplashPhoto[]>([]);
  const [isSearchingPhotos, setIsSearchingPhotos] = useState(false);
  const [showPhotoGrid, setShowPhotoGrid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);
  const [photoSource, setPhotoSource] = useState<"file" | "unsplash" | null>(null);
  const [isSkuLocked, setIsSkuLocked] = useState(true);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [genericEans, setGenericEans] = useState<string[]>([]);


  const getDefaults = (p?: Product | null): FormValues => ({
    sku: p?.sku || "",
    barcode: p?.barcode || "",
    ean: (p as any)?.ean || p?.barcode || "",
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
    gtin_cx: (p as any)?.gtin_cx || "",
    box_quantity: (p as any)?.box_quantity ?? "",
    supplier_skus: p?.product_supplier_skus?.map(s => ({
      supplier_name: s.supplier_name,
      supplier_sku: s.supplier_sku
    })) || [],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: getDefaults(product),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "supplier_skus",
  });



  const sincronizarSkuEan = (ean: string) => {
    if (ean) {
      form.setValue("sku", ean);
    }
  };

  useEffect(() => {
    if (open) {
      form.reset(getDefaults(product));
      setSkuConflict(null);
      setPhotoPreview(product?.image_url || null);
      setUnsplashPhotos([]);
      setShowPhotoGrid(false);
      selectedFileRef.current = null;
      setPhotoSource(product?.image_url ? "unsplash" : null);
      setIsSkuLocked(true);
      setGenericEans(
        (product?.product_alternative_gtins || [])
          .map((g: any) => g.gtin)
          .filter(Boolean)
      );
    }
  }, [open, product]);


  const isLoading = createProduct.isPending || updateProduct.isPending;

  const costVal = form.watch("cost");
  const priceVal = form.watch("price");
  const margin = typeof costVal === "number" && costVal > 0 && typeof priceVal === "number" && priceVal > 0
    ? (((priceVal - costVal) / costVal) * 100).toFixed(1)
    : null;

  const checkSkuExists = async (sku: string, excludeId?: string): Promise<boolean> => {
    let query = supabase.from("products").select("id").eq("sku", sku).eq("company_id", cid as string);
    query = query.limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query;
    return (data && data.length > 0) || false;
  };

  const checkEanExists = async (ean: string, excludeId?: string): Promise<boolean> => {
    if (!ean) return false;
    let query = supabase.from("products").select("id").eq("ean", ean).eq("company_id", cid as string);
    query = query.limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query;
    if (data && data.length > 0) return true;

    // Also check alternative GTINs
    const altQuery = supabase
      .from("product_alternative_gtins")
      .select("id")
      .eq("gtin", ean);
    
    // We don't have company_id in product_alternative_gtins but it's linked to products
    // However, the query is simple enough that we can just check if it exists globally 
    // or better yet, join with products to filter by company_id if needed.
    // For now, let's keep it simple as alternative GTINs should be unique-ish.
    
    const { data: altGtin } = await altQuery.limit(1);
    return (altGtin && altGtin.length > 0) || false;
  };

  const uploadImageToStorage = async (sku: string): Promise<string | null> => {
    if (!cid) throw new Error("Empresa não identificada");
    
    // Upload from file
    if (photoSource === "file" && selectedFileRef.current) {
      const file = selectedFileRef.current;
      const ext = file.name.split(".").pop() || "jpg";
      // Path standardized with company_id for RLS isolation: product-images/{company_id}/{sku}-{timestamp}.ext
      const path = `${cid}/${sku}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (error) throw error;
      return path;
    }
    
    // Download from Unsplash URL and upload
    if (photoSource === "unsplash" && photoPreview && photoPreview.startsWith("http")) {
      try {
        const res = await fetch(photoPreview);
        const blob = await res.blob();
        const path = `${cid}/${sku}-${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        return path;
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
      ean: values.ean || values.barcode || undefined,
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
      gtin_cx: values.gtin_cx || undefined,
      box_quantity: typeof values.box_quantity === "number" ? values.box_quantity : undefined,
      supplier_skus: values.supplier_skus?.map(s => ({
        supplier_name: s.supplier_name,
        supplier_sku: s.supplier_sku
      })),
      // Persiste o estoque inicial APENAS na criação de um novo produto
      ...(!product && typeof values.stock_initial === "number"
        ? { stock_physical: values.stock_initial }
        : {}),
    };

    let savedProduct: any = null;
    if (product) {
      const result: any = await updateProduct.mutateAsync({ id: product.id, data: formData });
      savedProduct = result || product;
      onSuccess?.(result);
    } else {
      const result = await createProduct.mutateAsync(formData);
      savedProduct = result;
      onSuccess?.(result);
    }


    // Sync EANs genéricos
    try {
      const productId = savedProduct?.id || product?.id;
      if (productId && cid) {
        await supabase
          .from("product_alternative_gtins")
          .delete()
          .eq("product_id", productId)
          .eq("company_id", cid as string);
        const cleaned = Array.from(
          new Set(
            genericEans
              .map((e) => (e || "").trim())
              .filter((e) => e.length > 0)
          )
        );
        if (cleaned.length > 0) {
          await supabase.from("product_alternative_gtins").insert(
            cleaned.map((gtin) => ({
              product_id: productId,
              company_id: cid as string,
              gtin,
              tipo: "generico",
            })) as any
          );
        }
      }
    } catch (err: any) {
      toast({
        title: "Erro ao salvar EANs genéricos",
        description: err.message,
        variant: "destructive",
      });
    }

    resetDirty();
    onOpenChange(false);
    form.reset();
  };

  const onSubmit = async (values: FormValues) => {
    const skuExists = await checkSkuExists(values.sku, product?.id);
    if (skuExists) {
      const suggested = generateAlternativeSku(values.sku);
      setSkuConflict({ suggestedSku: suggested, pendingValues: values });
      return;
    }

    const eanExists = await checkEanExists(values.ean || values.barcode || "", product?.id);
    if (eanExists) {
      toast({
        title: "Código EAN já cadastrado",
        description: "Já existe outro produto com este EAN/Código de barras.",
        variant: "destructive",
      });
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
          apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY),
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
      <Dialog open={open} onOpenChange={guardedClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>{product ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] px-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pb-2" onChange={markDirty}>
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
                      <FormLabel>SKU Interno (= EAN)</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <div className="relative flex-1">
                            <Input 
                              {...field} 
                              placeholder="Será igual ao EAN" 
                              readOnly={isSkuLocked}
                              className={isSkuLocked ? "pr-10 bg-muted/50 cursor-not-allowed" : ""}
                            />
                            {isGeneratingSku && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon" 
                          className="shrink-0"
                          title={isSkuLocked ? "Desbloquear para edição" : "Bloquear edição"}
                          onClick={() => setIsSkuLocked(!isSkuLocked)}
                        >
                          {isSkuLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </Button>
                      </div>
                      {!form.getValues("ean") && (
                        <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3" />
                          ⚠️ Cadastre o EAN para gerar o SKU
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="ean" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código EAN (Chave Mestre)</FormLabel>
                      <div className="flex gap-2 items-center">
                        <FormControl>
                          <BarcodeScannerInput
                            value={field.value || ""}
                            onChange={(v) => {
                              field.onChange(v);
                              form.setValue("barcode", v);
                              sincronizarSkuEan(v);
                            }}
                            onScan={(code) => { 
                              field.onChange(code); 
                              form.setValue("barcode", code);
                              sincronizarSkuEan(code);
                              toast({ title: "✓ EAN lido!", description: code }); 
                            }}
                            placeholder="7891234567890"
                            showCameraButton
                          />
                        </FormControl>
                        <Button type="button" variant="outline" size="icon" title="Gerar EAN-13" onClick={() => { 
                          const ean = generateEAN13(); 
                          field.onChange(ean); 
                          form.setValue("barcode", ean); 
                          sincronizarSkuEan(ean);
                          toast({ title: "EAN-13 gerado!", description: ean }); 
                        }}>
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

                {/* EANs Genéricos */}
                <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <FormLabel className="text-base font-semibold">EANs Genéricos</FormLabel>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Códigos adicionais que apontam para este mesmo produto físico (variações de anúncio/catálogo).
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={async () => {
                        // gera até 5 tentativas únicas
                        for (let i = 0; i < 5; i++) {
                          const candidate = generateGenericEAN13();
                          if (genericEans.includes(candidate)) continue;
                          // verifica duplicidade na empresa
                          const { data: prodConflict } = await supabase
                            .from("products")
                            .select("id")
                            .eq("company_id", cid as string)
                            .or(`ean.eq.${candidate},barcode.eq.${candidate}`)
                            .limit(1);
                          const { data: altConflict } = await supabase
                            .from("product_alternative_gtins")
                            .select("id")
                            .eq("company_id", cid as string)
                            .eq("gtin", candidate)
                            .limit(1);
                          if ((!prodConflict || prodConflict.length === 0) && (!altConflict || altConflict.length === 0)) {
                            setGenericEans((prev) => [...prev, candidate]);
                            markDirty();
                            toast({ title: "EAN genérico gerado!", description: candidate });
                            return;
                          }
                        }
                        toast({ title: "Não foi possível gerar EAN único", variant: "destructive" });
                      }}
                    >
                      <Wand2 className="mr-2 h-4 w-4" />
                      Gerar EAN
                    </Button>
                  </div>

                  {genericEans.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Nenhum EAN genérico cadastrado
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {genericEans.map((ean, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Badge variant="secondary" className="shrink-0">Genérico</Badge>
                          <Input
                            value={ean}
                            onChange={(e) => {
                              const v = e.target.value;
                              setGenericEans((prev) => prev.map((x, i) => (i === idx ? v : x)));
                              markDirty();
                            }}
                            placeholder="EAN-13"
                            className="h-9 font-mono"
                          />
                          {ean && ean.length === 13 && (
                            <span className={`text-xs shrink-0 ${isValidEAN13(ean) ? "text-emerald-500" : "text-destructive"}`}>
                              {isValidEAN13(ean) ? "✓" : "✗"}
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            title="Copiar"
                            onClick={() => {
                              navigator.clipboard?.writeText(ean);
                              toast({ title: "EAN copiado!", description: ean });
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setGenericEans((prev) => prev.filter((_, i) => i !== idx));
                              markDirty();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>


                {/* Suppliers (External SKUs) */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-base font-semibold">Fornecedores (SKUs externos)</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ supplier_name: "", supplier_sku: "" })}
                      className="h-8"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar fornecedor
                    </Button>
                  </div>
                  
                  {fields.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Nenhum SKU de fornecedor cadastrado.
                    </p>
                  )}

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-3 items-end group">
                        <FormField
                          control={form.control}
                          name={`supplier_skus.${index}.supplier_name`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-xs">Fornecedor {index + 1}</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Nome do fornecedor" className="h-9" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`supplier_skus.${index}.supplier_sku`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-xs">SKU</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="SKU do fornecedor" className="h-9" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* GTIN CX (Box barcode) */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="gtin_cx" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        📦 GTIN CX
                        <span className="text-[10px] text-muted-foreground ml-1" title="Código de barras da caixa fechada. Usado para dar entrada em lote.">(caixa)</span>
                      </FormLabel>
                      <FormControl>
                        <BarcodeScannerInput
                          value={field.value || ""}
                          onChange={(v) => field.onChange(v)}
                          onScan={(code) => { field.onChange(code); toast({ title: "✓ GTIN CX lido!", description: code }); }}
                          placeholder="Código da caixa fechada"
                          showCameraButton
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="box_quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Qtd por caixa
                        <span className="text-[10px] text-muted-foreground ml-1" title="Quantidade de unidades dentro de cada caixa fechada.">(un)</span>
                      </FormLabel>
                      <FormControl><Input type="number" {...field} placeholder="Ex: 12" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>


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
                  <Button type="button" variant="outline" onClick={() => guardedClose(false)}>Cancelar</Button>
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
      <UnsavedChangesDialog open={showConfirm} onDiscard={confirmDiscard} onContinue={confirmContinue} />
    </>
  );
}
