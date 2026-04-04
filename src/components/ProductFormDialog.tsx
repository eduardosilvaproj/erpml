import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCategories, useSuppliers, useCreateProduct, useUpdateProduct, type Product, type ProductFormData } from "@/hooks/useProductData";
import { Loader2, Sparkles, Wand2, Camera } from "lucide-react";
import { enrichProduct } from "@/lib/enrich-product";
import { useToast } from "@/hooks/use-toast";
import { generateEAN13, isValidEAN13 } from "@/lib/ean13";
import { BarcodeScanner } from "@/components/BarcodeScanner";

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
});

type FormValues = z.infer<typeof schema>;

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  const { toast } = useToast();
  const { data: categories } = useCategories();
  const { data: suppliers } = useSuppliers();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

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
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: getDefaults(product),
  });

  // Reset form and suppliers when product changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset(getDefaults(product));
      setSelectedSuppliers(product?.product_suppliers?.map((ps) => ps.supplier_id) || []);
    }
  }, [open, product]);

  const isLoading = createProduct.isPending || updateProduct.isPending;

  const onSubmit = async (values: FormValues) => {
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
      supplier_ids: selectedSuppliers,
    };

    if (product) {
      await updateProduct.mutateAsync({ id: product.id, data: formData });
    } else {
      await createProduct.mutateAsync(formData);
    }
    onOpenChange(false);
    form.reset();
    setSelectedSuppliers([]);
  };

  const toggleSupplier = (supplierId: string) => {
    setSelectedSuppliers((prev) =>
      prev.includes(supplierId) ? prev.filter((id) => id !== supplierId) : [...prev, supplierId]
    );
  };

  const handleEnrich = async () => {
    const name = form.getValues("name");
    if (!name) {
      toast({ title: "Informe o nome do produto primeiro", variant: "destructive" });
      return;
    }
    setIsEnriching(true);
    try {
      const data = await enrichProduct({
        productName: name,
        ean: form.getValues("barcode") || undefined,
      });
      // Only fill empty fields
      if (data.description && !form.getValues("description")) {
        form.setValue("description", data.description);
      }
      if (data.weight_kg != null && !form.getValues("weight")) {
        form.setValue("weight", data.weight_kg);
      }
      if (data.width_cm != null && !form.getValues("width")) {
        form.setValue("width", data.width_cm);
      }
      if (data.height_cm != null && !form.getValues("height")) {
        form.setValue("height", data.height_cm);
      }
      if (data.depth_cm != null && !form.getValues("depth")) {
        form.setValue("depth", data.depth_cm);
      }
      if (data.suggested_price_brl != null && form.getValues("price") === 0) {
        form.setValue("price", data.suggested_price_brl);
      }
      // Try to match suggested category
      if (data.suggested_category && !form.getValues("category_id") && categories) {
        const match = categories.find(
          (c) => c.name.toLowerCase() === data.suggested_category!.toLowerCase()
        );
        if (match) form.setValue("category_id", match.id);
      }
      toast({ title: "Dados preenchidos com IA!", description: "Revise os campos antes de salvar." });
    } catch (err: any) {
      toast({ title: "Erro ao buscar dados", description: err.message, variant: "destructive" });
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="sku" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU *</FormLabel>
                    <FormControl><Input {...field} placeholder="SKU-001" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="barcode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código de Barras</FormLabel>
                    <div className="flex gap-2">
                      <FormControl><Input {...field} placeholder="7891234567890" /></FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Escanear via câmera"
                        onClick={() => setShowScanner((v) => !v)}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Gerar EAN-13"
                        onClick={() => {
                          const ean = generateEAN13();
                          form.setValue("barcode", ean);
                          toast({ title: "EAN-13 gerado!", description: ean });
                        }}
                      >
                        <Wand2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {field.value && field.value.length === 13 && (
                      <p className={`text-xs ${isValidEAN13(field.value) ? "text-green-600" : "text-destructive"}`}>
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
                  <BarcodeScanner
                    onScan={(code) => {
                      form.setValue("barcode", code);
                      setShowScanner(false);
                      toast({ title: "Código escaneado!", description: code });
                    }}
                  />
                </div>
              )}

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Produto *</FormLabel>
                  <FormControl><Input {...field} placeholder="Nome do produto" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleEnrich}
                disabled={isEnriching}
                className="w-full"
              >
                {isEnriching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isEnriching ? "Buscando dados com IA..." : "Preencher com IA"}
              </Button>

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl><Textarea {...field} placeholder="Descrição do produto" rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="category_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="cost" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custo (R$) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço Venda (R$) *</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
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

              <FormField control={form.control} name="min_stock" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estoque Mínimo</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                </FormItem>
              )} />

              {/* Suppliers multi-select */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Fornecedores</label>
                <div className="rounded-md border p-3 space-y-2 max-h-40 overflow-y-auto">
                  {suppliers && suppliers.length > 0 ? (
                    suppliers.map((sup) => (
                      <label key={sup.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-2 py-1">
                        <Checkbox
                          checked={selectedSuppliers.includes(sup.id)}
                          onCheckedChange={() => toggleSupplier(sup.id)}
                        />
                        <span className="text-sm">{sup.name}</span>
                        {sup.cnpj && <span className="text-xs text-muted-foreground">({sup.cnpj})</span>}
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {product ? "Salvar" : "Criar Produto"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
