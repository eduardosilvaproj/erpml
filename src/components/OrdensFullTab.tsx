import { useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Eye, Trash2, Play, Search, X, Loader2, Clock, Package, CheckCircle2, Sparkles, FileText, Upload, AlertCircle } from "lucide-react";
import { SugestaoOrdemIADialog, type SugestaoItem } from "@/components/SugestaoOrdemIADialog";
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
import * as pdfjsLib from "pdfjs-dist";

// Set worker src for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { data: company } = useMyCompany();
  const { data: members } = useCompanyMembers(companyId || undefined);
  const { data: ordens, isLoading } = useOrdensFull();
  const createOrdem = useCreateOrdemFull();
  const deleteOrdem = useDeleteOrdem();
  const updateStatus = useUpdateOrdemStatus();

  const [createOpen, setCreateOpen] = useState(false);
  const [iaOpen, setIaOpen] = useState(false);
  const [viewOrdemId, setViewOrdemId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  // PDF Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<{
    shippingNumber: string;
    items: { ean: string; quantity: number; product?: any }[];
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Arquivo inválido", description: "Selecione um arquivo PDF do Mercado Livre.", variant: "destructive" });
      return;
    }

    setIsParsing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + " ";
      }

      console.log("Extracted PDF text:", fullText);

      // Extract Shipping Number (Frete # or Envio #)
      const shippingMatch = fullText.match(/(?:Frete|Envio|Transferência)\s*(?:#|nº)?\s*(\d{8,12})/i);
      const shippingNumber = shippingMatch ? shippingMatch[1] : "Não identificado";

      // Extract items (EAN and Quantity)
      // This is a heuristic approach, ML PDFs vary. 
      // Often EAN is a 13-digit number and quantity is nearby.
      const items: { ean: string; quantity: number }[] = [];
      
      // Match EAN (13 digits) and look for a quantity after it
      // Format usually: EAN [Description] Qtd
      const eanRegex = /(\d{13})/g;
      let match;
      while ((match = eanRegex.exec(fullText)) !== null) {
        const ean = match[1];
        // Look ahead for quantity (usually a number after some text)
        const textAfter = fullText.substring(match.index + 13, match.index + 100);
        const qtyMatch = textAfter.match(/(\d+)\s*(?:un|unidades|pc|peças)?/i);
        if (qtyMatch) {
          items.push({ ean, quantity: parseInt(qtyMatch[1]) });
        }
      }

      // Deduplicate by EAN (sometimes it appears multiple times)
      const uniqueItems = items.reduce((acc, curr) => {
        const existing = acc.find(i => i.ean === curr.ean);
        if (existing) {
          existing.quantity = Math.max(existing.quantity, curr.quantity);
        } else {
          acc.push(curr);
        }
        return acc;
      }, [] as typeof items);

      if (uniqueItems.length === 0) {
        throw new Error("Não foi possível encontrar produtos no PDF. Verifique se o arquivo é um pedido do Mercado Livre FULL.");
      }

      // Link items with products in database
      const eans = uniqueItems.map(i => i.ean);
      const { data: products } = await supabase
        .from("products")
        .select("id, name, sku, barcode, image_url, stock_physical")
        .in("barcode", eans);

      const itemsWithProducts = uniqueItems.map(item => ({
        ...item,
        product: products?.find(p => p.barcode === item.ean)
      }));

      setParsedData({ shippingNumber, items: itemsWithProducts });
      setPreviewOpen(true);
      toast({ title: "PDF lido com sucesso!", description: `${uniqueItems.length} produtos encontrados.` });
    } catch (err: any) {
      console.error("PDF Parsing error:", err);
      toast({ title: "Erro ao ler PDF", description: err.message, variant: "destructive" });
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmParsedOrder = async () => {
    if (!parsedData) return;

    const validItems = parsedData.items.filter(i => i.product);
    if (validItems.length === 0) {
      toast({ title: "Nenhum produto vinculado", description: "Vincule os produtos do PDF ao estoque antes de continuar.", variant: "destructive" });
      return;
    }

    try {
      await createOrdem.mutateAsync({
        descricao: `Pedido ML #${parsedData.shippingNumber}`,
        prazo: null,
        atribuido_para: null,
        itens: validItems.map(i => ({
          product_id: i.product.id,
          qtd_solicitada: i.quantity
        })),
        enviarParaSeparacao: true
      });
      toast({ title: "Ordem criada e enviada para separação!" });
      setPreviewOpen(false);
      setParsedData(null);
    } catch (err: any) {
      toast({ title: "Erro ao criar ordem", description: err.message, variant: "destructive" });
    }
  };

  // Carrega a ordem em localStorage e navega para /movimentacao-full
  const handleStartSeparation = async (ordem: OrdemFull) => {
    try {
      setStartingId(ordem.id);
      const { data: itens, error } = await supabase
        .from("ordens_full_itens")
        .select("*, product:products(id, name, sku, barcode, image_url, stock_physical)")
        .eq("ordem_id", ordem.id);
      if (error) throw error;

      const produtos = (itens || [])
        .filter((it: any) => it.product)
        .map((it: any) => ({
          product_id: it.product.id,
          name: it.product.name,
          sku: it.product.sku,
          barcode: it.product.barcode,
          image_url: it.product.image_url,
          stock_physical: it.product.stock_physical,
          qtd_solicitada: it.qtd_solicitada,
        }));

      localStorage.setItem("ordem_ativa", JSON.stringify({
        id: ordem.id,
        numero: ordem.numero,
        descricao: ordem.descricao,
        produtos,
      }));

      // Marca como em_separacao se ainda estiver aguardando
      if (ordem.status === "aguardando") {
        try { await updateStatus.mutateAsync({ id: ordem.id, status: "em_separacao" }); } catch {}
      }

      toast({ title: `📋 Ordem ${ordem.numero} carregada para separação` });
      navigate("/movimentacao-full");
    } catch (e: any) {
      toast({ title: "Erro ao iniciar separação", description: e.message, variant: "destructive" });
    } finally {
      setStartingId(null);
    }
  };

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
    <div className="space-y-6">
      {/* ETAPA 1 — Carregar Pedido ML */}
      <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">📄 Carregar PDF do Mercado Livre</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                ETAPA 1 — Arraste o PDF do pedido ou clique no botão abaixo para selecionar. 
                O sistema identificará os produtos e quantidades automaticamente.
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="application/pdf"
              className="hidden"
            />
            <Button 
              size="lg" 
              className="px-8 gap-2 h-12 text-base font-semibold shadow-lg shadow-primary/20"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Lendo PDF...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  Selecionar PDF Mercado Livre
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog do PDF */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="p-6 border-b bg-muted/30">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Preview da Ordem</DialogTitle>
              <div className="mt-2 space-y-1">
                <p className="text-xl font-semibold text-primary">
                  Frete #{parsedData?.shippingNumber}
                </p>
                <p className="text-sm text-muted-foreground font-medium">
                  {parsedData?.items.length} produtos · {parsedData?.items.reduce((acc, curr) => acc + curr.quantity, 0)} unidades
                </p>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead className="font-bold text-foreground">PRODUTO</TableHead>
                  <TableHead className="font-bold text-foreground">EAN</TableHead>
                  <TableHead className="font-bold text-foreground text-center">QTD</TableHead>
                  <TableHead className="font-bold text-foreground">VINCULADO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedData?.items.map((item, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.product?.image_url ? (
                          <img src={item.product.image_url} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                        )}
                        <span className="font-medium text-sm line-clamp-2 max-w-[200px]">
                          {item.product?.name || "Produto não identificado no PDF"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.ean}</TableCell>
                    <TableCell className="text-center font-bold text-base">{item.quantity}</TableCell>
                    <TableCell>
                      {item.product ? (
                        <div className="flex items-center gap-2 text-emerald-600 font-medium whitespace-nowrap">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>SKU {item.product.sku}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-500 font-medium whitespace-nowrap">
                          <AlertCircle className="h-4 w-4" />
                          <span>Não encontrado</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {parsedData?.items.some(i => !i.product) && (
              <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Produtos sem vínculo</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400/80 leading-relaxed">
                    Alguns produtos do PDF não foram encontrados no seu estoque pelo EAN. 
                    Eles serão ignorados se você confirmar. Cadastre-os com o EAN correto para vinculação automática.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 border-t bg-muted/30 gap-3 sm:gap-0">
            <Button 
              variant="outline" 
              className="gap-2 h-11"
              onClick={() => setPreviewOpen(false)}
            >
              <div className="flex items-center gap-2">
                <span>✏️</span>
                <span>Corrigir vínculos</span>
              </div>
            </Button>
            <Button 
              className="gap-2 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-lg shadow-emerald-500/20" 
              onClick={confirmParsedOrder}
              disabled={createOrdem.isPending || !parsedData?.items.some(i => i.product)}
            >
              {createOrdem.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  <span>✅</span>
                  <span>Confirmar e criar lista de separação</span>
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                      <Button size="sm" className="w-full" disabled={startingId === o.id} onClick={() => handleStartSeparation(o)}>
                        <Play className="h-3 w-3 mr-1" /> {startingId === o.id ? "Carregando..." : "Iniciar separação"}
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
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setIaOpen(true)}
                className="border-purple-500/40 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20">
                <Sparkles className="h-4 w-4 mr-1 text-purple-400" /> Sugestão IA
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nova ordem
              </Button>
            </div>
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
                              <Button size="sm" variant="default" disabled={startingId === o.id} onClick={() => handleStartSeparation(o)}>
                                <Play className="h-3 w-3 mr-1" /> {startingId === o.id ? "..." : "Executar"}
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" title="Ver" onClick={() => setViewOrdemId(o.id)}>
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

      {/* Modal Sugestão IA */}
      <SugestaoOrdemIADialog
        open={iaOpen}
        onOpenChange={setIaOpen}
        onApply={(items: SugestaoItem[]) => {
          setNovosItens(items.map((s) => ({
            product_id: s.id, name: s.name, sku: s.sku, image_url: s.image_url,
            stock_physical: s.stock_physical, qtd: s.qtd_sugerida,
          })));
          setDescricao(`Envio sugerido pela IA — ${new Date().toLocaleDateString("pt-BR")}`);
          setCreateOpen(true);
        }}
      />

      {/* Visualização / detalhes (somente leitura via dialog) */}
      <OrdemSeparacaoDialog
        ordemId={viewOrdemId}
        onClose={() => setViewOrdemId(null)}
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
