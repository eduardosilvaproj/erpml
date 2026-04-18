import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Eye, Trash2, Play, Search, X, Loader2, Clock, Package, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useMyCompany, useCompanyMembers } from "@/hooks/useCompanyData";
import { useProducts } from "@/hooks/useProductData";
import {
  useOrdensFull, useCreateOrdemFull, useDeleteOrdem, useUpdateOrdemStatus,
  ordemStatusBadge, type OrdemFull,
} from "@/hooks/useOrdensFull";
import { OrdemSeparacaoDialog } from "@/components/OrdemSeparacaoDialog";

interface NovoItem {
  product_id: string;
  name: string;
  sku: string;
  image_url: string | null;
  stock_physical: number;
  qtd: number;
}

export const OrdensFullTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { data: company } = useMyCompany();
  const { data: members } = useCompanyMembers(companyId || undefined);
  const { data: ordens, isLoading } = useOrdensFull();
  const createOrdem = useCreateOrdemFull();
  const deleteOrdem = useDeleteOrdem();
  const updateStatus = useUpdateOrdemStatus();

  const [createOpen, setCreateOpen] = useState(false);
  const [executeOrdemId, setExecuteOrdemId] = useState<string | null>(null);

  // Form state
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [atribuidoPara, setAtribuidoPara] = useState<string>("any");
  const [productSearch, setProductSearch] = useState("");
  const [novosItens, setNovosItens] = useState<NovoItem[]>([]);
  const [qtdInput, setQtdInput] = useState("1");

  const { data: searchResults } = useProducts({
    search: productSearch || undefined,
    page: 1,
    pageSize: 8,
    sortBy: "name",
    sortOrder: "asc",
  });

  // Detect role
  const myMember = members?.find((m) => m.user_id === user?.id);
  const isOwner = company?.owner_id === user?.id;
  const isManager = myMember?.role === "manager";
  const canManageOrders = isOwner || isManager;

  const myOrders = useMemo(() => {
    if (!ordens || !user) return [];
    return ordens.filter((o) => o.atribuido_para === user.id || o.atribuido_para === null);
  }, [ordens, user]);

  // Cards summary
  const summary = useMemo(() => {
    const list = ordens || [];
    const today = new Date().toDateString();
    return {
      abertas: list.filter((o) => o.status !== "concluida" && o.status !== "cancelada").length,
      aguardando: list.filter((o) => o.status === "aguardando").length,
      em_separacao: list.filter((o) => o.status === "em_separacao").length,
      concluidas_hoje: list.filter((o) => o.status === "concluida" && o.concluida_em && new Date(o.concluida_em).toDateString() === today).length,
    };
  }, [ordens]);

  const resetForm = () => {
    setDescricao(""); setPrazo(""); setAtribuidoPara("any");
    setNovosItens([]); setProductSearch(""); setQtdInput("1");
  };

  const addProduct = (p: any) => {
    const qtd = parseInt(qtdInput) || 1;
    if (novosItens.find((i) => i.product_id === p.id)) {
      toast({ title: "Produto já adicionado", variant: "destructive" });
      return;
    }
    setNovosItens([...novosItens, {
      product_id: p.id, name: p.name, sku: p.sku, image_url: p.image_url,
      stock_physical: p.stock_physical, qtd,
    }]);
    setProductSearch(""); setQtdInput("1");
  };

  const removeItem = (id: string) => setNovosItens(novosItens.filter((i) => i.product_id !== id));

  const handleSave = async (enviar: boolean) => {
    if (!descricao.trim()) {
      toast({ title: "Informe um nome/descrição", variant: "destructive" });
      return;
    }
    if (novosItens.length === 0) {
      toast({ title: "Adicione ao menos um produto", variant: "destructive" });
      return;
    }
    try {
      await createOrdem.mutateAsync({
        descricao: descricao.trim(),
        prazo: prazo || null,
        atribuido_para: atribuidoPara === "any" ? null : atribuidoPara,
        itens: novosItens.map((i) => ({ product_id: i.product_id, qtd_solicitada: i.qtd })),
        enviarParaSeparacao: enviar,
      });
      toast({ title: enviar ? "Ordem enviada para separação" : "Rascunho salvo" });
      setCreateOpen(false); resetForm();
    } catch (e: any) {
      toast({ title: "Erro ao criar ordem", description: e.message, variant: "destructive" });
    }
  };

  const handleCancel = async (o: OrdemFull) => {
    if (!confirm(`Cancelar a ordem ${o.numero}?`)) return;
    await updateStatus.mutateAsync({ id: o.id, status: "cancelada" });
    toast({ title: "Ordem cancelada" });
  };

  const handleDelete = async (o: OrdemFull) => {
    if (o.status !== "rascunho") {
      toast({ title: "Apenas rascunhos podem ser excluídos", variant: "destructive" });
      return;
    }
    if (!confirm(`Excluir a ordem ${o.numero}?`)) return;
    await deleteOrdem.mutateAsync(o.id);
    toast({ title: "Ordem excluída" });
  };

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={ClipboardList} label="Ordens abertas" value={summary.abertas} color="text-primary" />
        <SummaryCard icon={Clock} label="Aguardando" value={summary.aguardando} color="text-yellow-500" />
        <SummaryCard icon={Package} label="Em separação" value={summary.em_separacao} color="text-blue-500" />
        <SummaryCard icon={CheckCircle2} label="Concluídas hoje" value={summary.concluidas_hoje} color="text-emerald-500" />
      </div>

      {/* Painel funcionário (ordens atribuídas) */}
      {!canManageOrders && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Ordens para separar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myOrders.filter((o) => o.status === "aguardando" || o.status === "em_separacao").length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma ordem atribuída a você</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {myOrders.filter((o) => o.status === "aguardando" || o.status === "em_separacao").map((o) => (
                  <Card key={o.id} className="border-primary/20">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">{o.numero}</span>
                        <Badge variant="outline" className={ordemStatusBadge(o.status).cls}>{ordemStatusBadge(o.status).label}</Badge>
                      </div>
                      <p className="font-medium text-sm line-clamp-2">{o.descricao || "Sem descrição"}</p>
                      <div className="text-xs text-muted-foreground">
                        {o.total_produtos} produtos • {o.total_itens} unidades
                        {o.prazo && <> • Prazo {new Date(o.prazo).toLocaleDateString("pt-BR")}</>}
                      </div>
                      <Button size="sm" className="w-full" onClick={() => setExecuteOrdemId(o.id)}>
                        <Play className="h-3 w-3 mr-1" /> Iniciar separação
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lista geral (Gestor) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Ordens de Envio FULL
          </CardTitle>
          {canManageOrders && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova ordem
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
          ) : (ordens || []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma ordem criada ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-center">Produtos</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ordens || []).map((o) => {
                    const responsavel = members?.find((m) => m.user_id === o.atribuido_para);
                    const podeExecutar = (o.atribuido_para === user?.id || o.atribuido_para === null) && (o.status === "aguardando" || o.status === "em_separacao");
                    const sb = ordemStatusBadge(o.status);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.numero}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{o.descricao || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-center">{o.total_produtos}</TableCell>
                        <TableCell className="text-center">{o.total_itens}</TableCell>
                        <TableCell className="text-xs">
                          {o.atribuido_para ? (responsavel?.profile?.full_name || "—") : <span className="text-muted-foreground">Qualquer</span>}
                        </TableCell>
                        <TableCell><Badge variant="outline" className={sb.cls}>{sb.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {podeExecutar && (
                              <Button size="sm" variant="default" onClick={() => setExecuteOrdemId(o.id)}>
                                <Play className="h-3 w-3 mr-1" /> Executar
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" title="Ver" onClick={() => setExecuteOrdemId(o.id)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canManageOrders && o.status !== "concluida" && o.status !== "cancelada" && (
                              <Button size="icon" variant="ghost" title="Cancelar" onClick={() => handleCancel(o)}>
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                            {canManageOrders && o.status === "rascunho" && (
                              <Button size="icon" variant="ghost" title="Excluir" onClick={() => handleDelete(o)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
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

      {/* Modal Nova Ordem */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Envio FULL</DialogTitle>
            <DialogDescription>Crie uma ordem de separação para o estoque FULL.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome / descrição da ordem *</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Envio semanal — Semana 16" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Atribuir a</Label>
                <Select value={atribuidoPara} onValueChange={setAtribuidoPara}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer funcionário</SelectItem>
                    {members?.filter((m) => m.is_active).map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.profile?.full_name || m.user_id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prazo (opcional)</Label>
                <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Buscar e adicionar produtos</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Nome ou SKU..." />
                </div>
                <Input type="number" min={1} value={qtdInput} onChange={(e) => setQtdInput(e.target.value)} className="w-20" placeholder="Qtd" />
              </div>
              {productSearch && searchResults?.products && searchResults.products.length > 0 && (
                <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                  {searchResults.products.map((p) => (
                    <button key={p.id} type="button" onClick={() => addProduct(p)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-secondary/50 text-left text-sm border-b border-border/50 last:border-b-0">
                      {p.image_url ? <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.sku} • Estoque físico: {p.stock_physical}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {novosItens.length > 0 && (
              <div className="border border-border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Estoque</TableHead>
                      <TableHead className="text-center w-24">Qtd</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {novosItens.map((i) => (
                      <TableRow key={i.product_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {i.image_url ? <img src={i.image_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
                            <div>
                              <p className="text-sm">{i.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{i.sku}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">{i.stock_physical}</TableCell>
                        <TableCell className="text-center">
                          <Input type="number" min={1} value={i.qtd} onChange={(e) => {
                            const q = parseInt(e.target.value) || 1;
                            setNovosItens(novosItens.map((it) => it.product_id === i.product_id ? { ...it, qtd: q } : it));
                          }} className="w-16 mx-auto h-8 text-center" />
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => removeItem(i.product_id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-2 border-t border-border bg-secondary/20 text-xs text-muted-foreground text-right">
                  {novosItens.length} produtos • {novosItens.reduce((s, i) => s + i.qtd, 0)} unidades totais
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button>
            <Button variant="secondary" onClick={() => handleSave(false)} disabled={createOrdem.isPending}>
              Salvar rascunho
            </Button>
            <Button onClick={() => handleSave(true)} disabled={createOrdem.isPending}>
              {createOrdem.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Enviar para separação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execução / detalhes */}
      <OrdemSeparacaoDialog
        ordemId={executeOrdemId}
        onClose={() => setExecuteOrdemId(null)}
      />
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, color }: any) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);
