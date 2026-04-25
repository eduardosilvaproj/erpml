import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useTransferOrders } from "@/hooks/useTransferData";
import { Play, Download, Trash2, Link2, Video } from "lucide-react";
import { formatDuration } from "@/hooks/useFullRecorder";

interface Recording {
  id: string;
  envio_id: string | null;
  tipo: string;
  url_video: string;
  storage_path: string;
  duracao_segundos: number;
  tamanho_bytes: number;
  created_at: string;
}

const formatBytes = (b: number) => {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
};

const tipoBadge = (t: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    separacao: { label: "Separação", cls: "bg-primary/15 text-primary" },
    despacho: { label: "Despacho", cls: "bg-accent/15 text-accent-foreground" },
    sem_ordem: { label: "Sem ordem", cls: "bg-muted text-muted-foreground" },
  };
  const v = map[t] || { label: t, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={v.cls}>{v.label}</Badge>;
};

export const GravacoesFullTab = () => {
  const { toast } = useToast();
  const companyId = useCompanyId();
  const { data: orders } = useTransferOrders();
  const [items, setItems] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterVinculo, setFilterVinculo] = useState<string>("all");
  const [player, setPlayer] = useState<{ url: string; rec: Recording } | null>(null);
  const [linkRec, setLinkRec] = useState<Recording | null>(null);
  const [linkOrderId, setLinkOrderId] = useState<string>("");
  const [deleteRec, setDeleteRec] = useState<Recording | null>(null);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("gravacoes_full")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao carregar gravações", description: error.message, variant: "destructive" });
      return;
    }
    setItems((data || []) as Recording[]);
  };

  useEffect(() => { load(); }, [companyId]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("gravacoes-full:refresh", handler);
    return () => window.removeEventListener("gravacoes-full:refresh", handler);
  }, [companyId]);

  const filtered = useMemo(() => items.filter((r) => {
    if (filterTipo !== "all" && r.tipo !== filterTipo) return false;
    if (filterVinculo === "linked" && !r.envio_id) return false;
    if (filterVinculo === "unlinked" && r.envio_id) return false;
    return true;
  }), [items, filterTipo, filterVinculo]);

  const orderNumberFor = (envioId: string | null) => {
    if (!envioId) return null;
    return orders?.find((o) => o.id === envioId)?.order_number ?? envioId.slice(0, 8);
  };

  const openPlayer = async (rec: Recording) => {
    const { data, error } = await supabase.storage.from("gravacoes-full").createSignedUrl(rec.storage_path, 60 * 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Não foi possível abrir", description: error?.message || "URL inválida", variant: "destructive" });
      return;
    }
    setPlayer({ url: data.signedUrl, rec });
  };

  const download = async (rec: Recording) => {
    const { data, error } = await supabase.storage.from("gravacoes-full").createSignedUrl(rec.storage_path, 60 * 5, { download: true });
    if (error || !data?.signedUrl) {
      toast({ title: "Falha ao baixar", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (rec: Recording) => {
    if (!confirm("Excluir esta gravação? Esta ação não pode ser desfeita.")) return;
    await supabase.storage.from("gravacoes-full").remove([rec.storage_path]);
    const { error } = await supabase.from("gravacoes_full").delete().eq("id", rec.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Gravação excluída" });
    load();
  };

  const linkToOrder = async () => {
    if (!linkRec || !linkOrderId) return;
    const { error } = await supabase
      .from("gravacoes_full")
      .update({ envio_id: linkOrderId })
      .eq("id", linkRec.id);
    if (error) {
      toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Gravação vinculada à ordem" });
    setLinkRec(null);
    setLinkOrderId("");
    load();
  };

  const recentOrders = (orders || []).slice(0, 30);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4 text-red-500" /> Gravações de Envio FULL
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="separacao">Separação</SelectItem>
                <SelectItem value="despacho">Despacho</SelectItem>
                <SelectItem value="sem_ordem">Sem ordem</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterVinculo} onValueChange={setFilterVinculo}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="linked">Com ordem</SelectItem>
                <SelectItem value="unlinked">Sem ordem</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>Atualizar</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma gravação encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead className="w-[200px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const ord = orderNumberFor(r.envio_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>{tipoBadge(r.tipo)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {ord ? `#${ord}` : <Badge variant="outline" className="bg-muted text-muted-foreground">Sem ordem</Badge>}
                        </TableCell>
                        <TableCell className="text-xs">{formatDuration(r.duracao_segundos)}</TableCell>
                        <TableCell className="text-xs">{formatBytes(r.tamanho_bytes)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" title="Ver" onClick={() => openPlayer(r)}>
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                            {!r.envio_id && (
                              <Button size="icon" variant="ghost" title="Vincular a uma ordem" onClick={() => { setLinkRec(r); setLinkOrderId(""); }}>
                                <Link2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" title="Baixar" onClick={() => download(r)}>
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Excluir" onClick={() => remove(r)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Player */}
      <Dialog open={!!player} onOpenChange={(o) => !o && setPlayer(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Gravação — {player?.rec.envio_id ? `Ordem ${orderNumberFor(player.rec.envio_id)}` : "Sem ordem vinculada"}
            </DialogTitle>
            <DialogDescription>
              {player && `${tipoBadgeLabel(player.rec.tipo)} • ${formatDuration(player.rec.duracao_segundos)} • ${new Date(player.rec.created_at).toLocaleString("pt-BR")}`}
            </DialogDescription>
          </DialogHeader>
          {player && (
            <video controls autoPlay className="w-full rounded-lg bg-black" src={player.url} />
          )}
          <DialogFooter>
            {player && (
              <Button variant="outline" onClick={() => download(player.rec)}>
                <Download className="mr-2 h-4 w-4" /> Baixar vídeo
              </Button>
            )}
            <Button onClick={() => setPlayer(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vincular */}
      <Dialog open={!!linkRec} onOpenChange={(o) => !o && setLinkRec(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular gravação a uma ordem</DialogTitle>
            <DialogDescription>Selecione uma das ordens de envio FULL recentes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Ordem de envio</Label>
            <Select value={linkOrderId} onValueChange={setLinkOrderId}>
              <SelectTrigger><SelectValue placeholder="Selecionar ordem..." /></SelectTrigger>
              <SelectContent>
                {recentOrders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.order_number} — {new Date(o.created_at).toLocaleDateString("pt-BR")} ({o.total_items} itens)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkRec(null)}>Cancelar</Button>
            <Button onClick={linkToOrder} disabled={!linkOrderId}>Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const tipoBadgeLabel = (t: string) =>
  t === "separacao" ? "Separação" : t === "despacho" ? "Despacho" : t === "sem_ordem" ? "Sem ordem" : t;
