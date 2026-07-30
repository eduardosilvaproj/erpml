import { useState, useEffect } from "react";
import { Plus, Trash2, Package, Loader2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCreateKit, useUpdateKit, type Kit, type KitFormData } from "@/hooks/useKitData";
import { useProducts } from "@/hooks/useProductData";

function ProductPicker({
  products,
  value,
  onChange,
}: {
  products: any[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal bg-background"
        >
          <span className="truncate">
            {selected ? `${selected.name} (${selected.sku})` : "Buscar produto..."}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[420px]" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Nome, SKU, EAN ou código de barras..." />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => {
                const keywords = [p.name, p.sku, p.ean || "", p.barcode || ""].join(" ");
                return (
                  <CommandItem
                    key={p.id}
                    value={keywords}
                    onSelect={() => {
                      onChange(p.id);
                    }}
                  >
                    <Check className={cn("h-4 w-4 mr-2", value === p.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        SKU {p.sku}{p.ean ? ` • EAN ${p.ean}` : ""}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface KitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kit?: Kit | null;
  initialData?: { ean?: string; name?: string };
  onSuccess?: (newKit: any) => void;
}

export const KitFormDialog = ({ open, onOpenChange, kit, initialData, onSuccess }: KitFormDialogProps) => {
  const { toast } = useToast();
  const { data: productsData } = useProducts({ pageSize: 500, sortBy: "name", sortOrder: "asc" });
  const products = productsData?.products || [];
  const createKit = useCreateKit();
  const updateKit = useUpdateKit();

  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formEan, setFormEan] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [formItems, setFormItems] = useState<{ product_id: string; quantity: number }[]>([]);

  useEffect(() => {
    if (open) {
      if (kit) {
        setFormName(kit.name);
        setFormSku(kit.sku);
        setFormEan((kit as any).ean || "");
        setFormDescription(kit.description || "");
        setFormPrice(kit.price);
        setFormActive(kit.active !== false);
        setFormItems(kit.kit_items?.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) || []);
      } else {
        setFormName(initialData?.name || "");
        setFormSku("");
        setFormEan(initialData?.ean || "");
        setFormDescription("");
        setFormPrice(0);
        setFormActive(true);
        setFormItems([]);
      }
    }
  }, [open, kit, initialData]);

  // SKU is generated at save time from product EANs — no useEffect needed

  const handleSave = async () => {
    if (!formName || formItems.length === 0) {
      toast({ title: "Preencha o nome e adicione ao menos 1 produto.", variant: "destructive" });
      return;
    }
    const autoSku = formSku.trim() || formItems
      .map(item => {
        const prod = products.find(p => p.id === item.product_id);
        return prod?.ean || prod?.barcode || prod?.sku || "";
      })
      .filter(Boolean)
      .join("/") || `KIT-${Date.now().toString(36).toUpperCase()}`;
    const data: KitFormData & { ean?: string } = {
      name: formName,
      sku: autoSku,
      ean: formEan,
      description: formDescription,
      price: formPrice,
      items: formItems
    };
    
    try {
      let result;
      if (kit) {
        result = await updateKit.mutateAsync({ id: kit.id, data });
      } else {
        result = await createKit.mutateAsync(data);
      }
      onSuccess?.(result);
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro ao salvar kit", description: error.message, variant: "destructive" });
    }
  };

  const addItem = () => setFormItems([...formItems, { product_id: "", quantity: 1 }]);
  const removeItem = (idx: number) => setFormItems(formItems.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: "product_id" | "quantity", value: string | number) => {
    setFormItems(formItems.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const isLoading = createKit.isPending || updateKit.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0 pr-14">
          <DialogTitle className="truncate pr-6">{kit ? "Editar Kit" : "Novo Kit"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do kit *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Kit Coloração Cabelo" />
              </div>
              <div className="space-y-2">
                <Label>SKU do kit (gerado automaticamente com EANs dos produtos)</Label>
                <Input value={formSku} onChange={(e) => setFormSku(e.target.value)} placeholder="Gerado com EANs dos produtos" className="font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>EAN do kit (opcional)</Label>
                <Input value={formEan} onChange={(e) => setFormEan(e.target.value)} placeholder="Código de barras" />
              </div>
              <div className="space-y-2">
                <Label>Preço de Venda</Label>
                <Input type="number" value={formPrice} onChange={(e) => setFormPrice(Number(e.target.value))} step="0.01" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Descrição do kit..." rows={2} />
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base font-bold">Produtos do Kit *</Label>
                <Button variant="outline" size="sm" onClick={addItem} type="button">
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Produto
                </Button>
              </div>
              
              <div className="space-y-3">
                {formItems.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
                    Nenhum produto adicionado ao kit.
                  </div>
                )}
                {formItems.map((item, idx) => (
                  <div key={`item-${idx}`} className="flex gap-3 items-end bg-muted/30 p-3 rounded-lg border border-border/50">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Produto</Label>
                      <ProductPicker
                        products={products}
                        value={item.product_id}
                        onChange={(val) => updateItem(idx, "product_id", val)}
                      />
                    </div>
                    <div className="w-24 space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Qtd</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                        className="bg-background"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 h-10 w-10 shrink-0"
                      onClick={() => removeItem(idx)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 border-t bg-muted/20">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="min-w-[120px]">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
            {kit ? "Atualizar Kit" : "Criar Kit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
