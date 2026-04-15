import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Store, ShoppingBag, CreditCard, Layers, ExternalLink, Loader2, Check, X } from "lucide-react";
import { useMyStore, useUpsertStore, useCheckSlugAvailability } from "@/hooks/useStoreData";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-mobile";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function MinhaLojaConfig() {
  const { data: store, isLoading } = useMyStore();
  const upsertStore = useUpsertStore();
  const checkSlug = useCheckSlugAvailability();

  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#8B5CF6");
  const [description, setDescription] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saleMode, setSaleMode] = useState<"mercadolivre" | "proprio" | "hibrido">("hibrido");
  const [isActive, setIsActive] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);

  useEffect(() => {
    if (store) {
      setStoreName(store.store_name);
      setSlug(store.slug);
      setPrimaryColor(store.primary_color);
      setDescription(store.description || "");
      setWhatsapp(store.whatsapp || "");
      setSaleMode(store.sale_mode);
      setIsActive(store.is_active);
    }
  }, [store]);

  const handleNameChange = (name: string) => {
    setStoreName(name);
    if (!store) {
      setSlug(slugify(name));
    }
  };

  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      return;
    }
    if (store?.slug === slug) {
      setSlugAvailable(true);
      return;
    }
    setSlugChecking(true);
    const timeout = setTimeout(async () => {
      const available = await checkSlug.mutateAsync(slug);
      setSlugAvailable(available);
      setSlugChecking(false);
    }, 500);
    return () => clearTimeout(timeout);
  }, [slug]);

  const handleSave = () => {
    if (!storeName.trim()) return toast.error("Nome da loja é obrigatório");
    if (!slug.trim() || slug.length < 3) return toast.error("Slug deve ter pelo menos 3 caracteres");
    if (slugAvailable === false) return toast.error("Este slug já está em uso");

    upsertStore.mutate({
      store_name: storeName.trim(),
      slug: slug.trim(),
      primary_color: primaryColor,
      description: description.trim() || null,
      whatsapp: whatsapp.trim() || null,
      sale_mode: saleMode,
      is_active: isActive,
    } as any);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const saleModes = [
    {
      value: "mercadolivre" as const,
      label: "Modo Mercado Livre",
      description: "Vitrine própria, compra redirecionada ao ML",
      icon: ShoppingBag,
    },
    {
      value: "proprio" as const,
      label: "Modo Loja Própria",
      description: "Checkout completo com pagamento via Asaas",
      icon: CreditCard,
    },
    {
      value: "hibrido" as const,
      label: "Modo Híbrido",
      description: "Comprador escolhe: ML ou pagamento direto",
      icon: Layers,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Store className="h-6 w-6" /> Configurar Minha Loja
          </h1>
          <p className="text-muted-foreground">Configure sua vitrine virtual</p>
        </div>
        <div className="flex items-center gap-3">
          {store && (
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Loja Ativa ✓" : "Loja Pausada"}
            </Badge>
          )}
          {store?.slug && isActive && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/loja/${store.slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Ver Vitrine
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>Dados da sua loja virtual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Loja *</Label>
              <Input value={storeName} onChange={e => handleNameChange(e.target.value)} placeholder="Minha Loja" />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL) *</Label>
              <div className="flex items-center gap-2">
                <Input value={slug} onChange={e => setSlug(slugify(e.target.value))} placeholder="minha-loja" />
                {slugChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!slugChecking && slugAvailable === true && <Check className="h-4 w-4 text-green-500" />}
                {!slugChecking && slugAvailable === false && <X className="h-4 w-4 text-red-500" />}
              </div>
              <p className="text-xs text-muted-foreground">URL: /loja/{slug || "..."}</p>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição curta da sua loja" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp (opcional)</Label>
              <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>Cor Primária</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
                <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-32" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Loja Ativa</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modo de Venda</CardTitle>
            <CardDescription>Como os clientes vão comprar na sua loja</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={saleMode} onValueChange={v => setSaleMode(v as any)} className="space-y-3">
              {saleModes.map(mode => (
                <label
                  key={mode.value}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    saleMode === mode.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <RadioGroupItem value={mode.value} className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      <mode.icon className="h-4 w-4" />
                      {mode.label}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{mode.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsertStore.isPending} size="lg">
          {upsertStore.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {store ? "Salvar Configurações" : "Criar Loja"}
        </Button>
      </div>
    </div>
  );
}
