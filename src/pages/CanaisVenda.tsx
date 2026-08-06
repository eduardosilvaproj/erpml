import { useState, useEffect } from "react";
import {
  Store, Monitor, RefreshCw, Plus, Trash2, Link2, Unplug,
  CheckCircle2, AlertTriangle, Loader2, Key, Globe, ShoppingCart,
  Settings as SettingsIcon, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type CanalTipo = "loja2" | "site" | "revenda";

interface Canal {
  id: string;
  nome: string;
  tipo: CanalTipo;
  url: string;
  token: string;
  conectado: boolean;
  createdAt: string;
}

const STORAGE_KEY = "stovix:canais-venda";

const TIPO_LABEL: Record<CanalTipo, string> = {
  loja2: "Loja 2",
  site: "Site",
  revenda: "Revenda",
};

const TIPO_ICON: Record<CanalTipo, React.ElementType> = {
  loja2: Store,
  site: Globe,
  revenda: ShoppingCart,
};

const TIPO_COLOR: Record<CanalTipo, string> = {
  loja2: "text-[#FB923C]",
  site: "text-[#60A5FA]",
  revenda: "text-[#A78BFA]",
};

function carregarCanais(): Canal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Canal[];
  } catch {
    return [];
  }
}

function salvarCanais(canais: Canal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(canais));
}

function gerarToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "stk_";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export default function CanaisVenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [canais, setCanais] = useState<Canal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testeandoId, setTestandoId] = useState<string | null>(null);

  // form state
  const [formNome, setFormNome] = useState("");
  const [formTipo, setFormTipo] = useState<CanalTipo>("loja2");
  const [formUrl, setFormUrl] = useState("");
  const [formToken, setFormToken] = useState("");

  useEffect(() => {
    setCanais(carregarCanais());
    setLoading(false);
  }, []);

  const persistir = (novos: Canal[]) => {
    setCanais(novos);
    salvarCanais(novos);
  };

  const adicionarCanal = () => {
    if (!formNome.trim()) {
      toast({ title: "Informe o nome do canal", variant: "destructive" });
      return;
    }
    if (!formUrl.trim()) {
      toast({ title: "Informe a URL do canal", variant: "destructive" });
      return;
    }
    if (!formToken.trim()) {
      toast({ title: "Informe o token de conexão", variant: "destructive" });
      return;
    }
    const novo: Canal = {
      id: crypto.randomUUID(),
      nome: formNome.trim(),
      tipo: formTipo,
      url: formUrl.trim(),
      token: formToken.trim(),
      conectado: false,
      createdAt: new Date().toISOString(),
    };
    persistir([...canais, novo]);
    setFormNome("");
    setFormUrl("");
    setFormToken("");
    setFormTipo("loja2");
    setDialogOpen(false);
    toast({ title: "Canal adicionado", description: `${novo.nome} (${TIPO_LABEL[novo.tipo]})` });
  };

  const removerCanal = (id: string) => {
    persistir(canais.filter((c) => c.id !== id));
    toast({ title: "Canal removido" });
  };

  const conectarCanal = (id: string) => {
    setTestandoId(id);
    // Simula validação do token — em produção isto chamaria o backend do canal
    setTimeout(() => {
      persistir(canais.map((c) => (c.id === id ? { ...c, conectado: true } : c)));
      setTestandoId(null);
      toast({ title: "Canal conectado", description: "Token validado com sucesso" });
    }, 900);
  };

  const desconectarCanal = (id: string) => {
    persistir(canais.map((c) => (c.id === id ? { ...c, conectado: false } : c)));
    toast({ title: "Canal desconectado" });
  };

  const gerarNovoToken = () => {
    setFormToken(gerarToken());
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" /> Canais de Venda
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie Loja 2, Site, Revenda e outros canais com conexão por token
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> Adicionar Canal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Adicionar Canal de Venda</DialogTitle>
              <DialogDescription>
                Cadastre um novo canal (Loja 2, Site, Revenda) e gere um token para conexão.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="canal-nome">Nome do Canal</Label>
                <Input
                  id="canal-nome"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: Loja Centro / Site Principal / Revenda João"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="canal-tipo">Tipo</Label>
                <Select value={formTipo} onValueChange={(v) => setFormTipo(v as CanalTipo)}>
                  <SelectTrigger id="canal-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loja2">Loja 2</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                    <SelectItem value="revenda">Revenda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="canal-url">URL / Endpoint</Label>
                <Input
                  id="canal-url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://loja2.exemplo.com ou endpoint do parceiro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="canal-token">Token de Conexão</Label>
                <div className="flex gap-2">
                  <Input
                    id="canal-token"
                    value={formToken}
                    onChange={(e) => setFormToken(e.target.value)}
                    placeholder="Cole o token fornecido ou gere um novo"
                    className="font-mono text-xs"
                  />
                  <Button type="button" variant="outline" onClick={gerarNovoToken}>
                    <Key className="h-4 w-4 mr-1" /> Gerar
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  O token é usado para autenticar a sincronização de estoque e pedidos entre o STOVIX e o canal.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={adicionarCanal}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estado vazio */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando canais...
        </div>
      ) : canais.length === 0 ? (
        <Card className="border-dashed bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Store className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold">Nenhum canal cadastrado</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Adicione Loja 2, Site ou Revenda e conecte via token para sincronizar estoque e vendas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canais.map((canal) => {
            const Icon = TIPO_ICON[canal.tipo];
            const cor = TIPO_COLOR[canal.tipo];
            return (
              <Card key={canal.id} className="border-border/50 bg-muted/10">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${cor}`} />
                      <div>
                        <CardTitle className="text-base">{canal.nome}</CardTitle>
                        <CardDescription className="text-xs">{TIPO_LABEL[canal.tipo]}</CardDescription>
                      </div>
                    </div>
                    {canal.conectado ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-500/15 text-amber-400 border-amber-500/30">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Pendente
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs space-y-1.5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-mono">{canal.url || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Key className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-mono">
                        {canal.token.slice(0, 8)}••••••••{canal.token.slice(-4)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {canal.conectado ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => desconectarCanal(canal.id)}
                        className="flex-1"
                      >
                        <Unplug className="h-3.5 w-3.5 mr-1" /> Desconectar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => conectarCanal(canal.id)}
                        disabled={testeandoId === canal.id}
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {testeandoId === canal.id ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5 mr-1" />
                        )}
                        Conectar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removerCanal(canal.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4">
          <RefreshCw className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Como funciona a conexão por token</p>
            <p className="text-muted-foreground mt-1">
              Cada canal recebe um token único. Use esse token no painel do canal parceiro (ou
              informe o token fornecido por ele) para autorizar a sincronização de estoque, pedidos
              e preços entre o STOVIX e o canal.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}