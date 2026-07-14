import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles, TrendingDown, TrendingUp, Scale, RefreshCcw, Pencil, Loader2, ArrowLeft, Check, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useCompanyId } from "@/hooks/useCompanyId";

type Step = "perguntas" | "loading" | "resultado";

const CRITERIOS = [
  { id: "full_baixo", icon: TrendingDown, label: "Estoque FULL mais baixo", desc: "Prioriza o que está acabando no FULL" },
  { id: "mais_vendidos", icon: TrendingUp, label: "Mais vendidos recentemente", desc: "Prioriza os que mais saem" },
  { id: "equilibrar", icon: Scale, label: "Equilibrar físico e FULL", desc: "Produtos com grande diferença" },
  { id: "estoque_minimo", icon: RefreshCcw, label: "Estoque FULL abaixo do mínimo", desc: "Apenas críticos" },
] as const;

const LOADING_MSGS = [
  "🔍 Analisando seu estoque...",
  "📊 Verificando histórico de vendas...",
  "🤖 Montando lista otimizada...",
];

export interface SugestaoItem {
  id: string;
  name: string;
  sku: string;
  image_url: string | null;
  stock_physical: number;
  stock_full: number;
  min_stock: number;
  vendas_30d: number;
  qtd_sugerida: number;
  motivo: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApply: (items: SugestaoItem[]) => void;
}

export const SugestaoOrdemIADialog = ({ open, onOpenChange, onApply }: Props) => {
  const { toast } = useToast();
  const companyId = useCompanyId();
  const [step, setStep] = useState<Step>("perguntas");
  const [quantidade, setQuantidade] = useState("10");
  const [criterio, setCriterio] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [suggestions, setSuggestions] = useState<SugestaoItem[]>([]);
  const [explanation, setExplanation] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data: categories } = useQuery({
    queryKey: ["categories", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").eq("company_id", companyId).order("name");
      return data || [];
    },
    enabled: !!companyId && open,
  });

  const reset = () => {
    setStep("perguntas"); setCriterio(""); setQuantidade("10"); setCategoryId("all");
    setSuggestions([]); setExplanation(""); setSelected({});
  };

  const handleClose = (o: boolean) => { onOpenChange(o); if (!o) reset(); };

  const gerarSugestao = async () => {
    if (!criterio) { toast({ title: "Selecione um critério", variant: "destructive" }); return; }
    setStep("loading");
    setLoadingMsgIdx(0);
    const interval = setInterval(() => setLoadingMsgIdx((i) => (i + 1) % LOADING_MSGS.length), 1500);

    try {
      const { data, error } = await supabase.functions.invoke("sugestao-ordem-full", {
        body: {
          quantidade: quantidade === "all" ? 999 : parseInt(quantidade) || 10,
          criterio,
          category_id: categoryId === "all" ? null : categoryId,
        },
      });
      clearInterval(interval);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const items: SugestaoItem[] = data.suggestions || [];
      if (items.length === 0) {
        toast({ title: "Nenhuma sugestão gerada", description: "Tente outro critério ou categoria.", variant: "destructive" });
        setStep("perguntas");
        return;
      }
      setSuggestions(items);
      setExplanation(data.explanation || "");
      setSelected(Object.fromEntries(items.map((i) => [i.id, true])));
      setStep("resultado");
    } catch (e: any) {
      clearInterval(interval);
      toast({ title: "Erro ao gerar sugestão", description: e.message, variant: "destructive" });
      setStep("perguntas");
    }
  };

  const updateQtd = (id: string, qtd: number) => {
    setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, qtd_sugerida: Math.max(1, qtd) } : s));
  };

  const aplicar = () => {
    const items = suggestions.filter((s) => selected[s.id]);
    if (items.length === 0) { toast({ title: "Selecione ao menos um produto", variant: "destructive" }); return; }
    onApply(items);
    handleClose(false);
  };

  const totalSelected = suggestions.filter((s) => selected[s.id]);
  const totalUnits = totalSelected.reduce((sum, s) => sum + s.qtd_sugerida, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" /> Sugestão IA — Ordem de Envio FULL
          </DialogTitle>
          <DialogDescription>Deixe a IA montar a melhor lista para enviar ao FULL hoje.</DialogDescription>
        </DialogHeader>

        {step === "perguntas" && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm text-muted-foreground pt-1">
                Olá! Vou ajudar a montar sua ordem de envio FULL. Me responda algumas perguntas rápidas:
              </p>
            </div>

            <div className="space-y-2">
              <Label>Quantos itens diferentes você quer enviar?</Label>
              <div className="flex gap-2 flex-wrap">
                {["5", "10", "20", "50", "all"].map((v) => (
                  <Button key={v} type="button" size="sm"
                    variant={quantidade === v ? "default" : "outline"}
                    onClick={() => setQuantidade(v)}>
                    {v === "all" ? "Todos" : v}
                  </Button>
                ))}
                <Input type="number" min={1} value={quantidade === "all" ? "" : quantidade}
                  onChange={(e) => setQuantidade(e.target.value)} className="w-24 h-9" placeholder="Custom" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Qual critério usar para escolher?</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {CRITERIOS.map((c) => {
                  const Icon = c.icon;
                  const active = criterio === c.id;
                  return (
                    <Card key={c.id}
                      onClick={() => setCriterio(c.id)}
                      className={`cursor-pointer transition-all hover:border-purple-500/50 ${active ? "border-purple-500 bg-purple-500/5" : ""}`}>
                      <CardContent className="p-3 flex items-start gap-3">
                        <Icon className={`h-5 w-5 mt-0.5 ${active ? "text-purple-400" : "text-muted-foreground"}`} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.label}</p>
                          <p className="text-xs text-muted-foreground">{c.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Card className="cursor-pointer hover:border-border" onClick={() => onOpenChange(false)}>
                <CardContent className="p-3 flex items-center gap-3">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">Deixa eu escolher manualmente</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <Label>Alguma categoria específica? (opcional)</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={gerarSugestao} className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
                <Sparkles className="h-4 w-4 mr-1" /> Gerar sugestão
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "loading" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center animate-pulse">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
              <Loader2 className="h-20 w-20 text-purple-400 animate-spin absolute -top-2 -left-2" />
            </div>
            <p className="text-sm text-muted-foreground transition-all">{LOADING_MSGS[loadingMsgIdx]}</p>
          </div>
        )}

        {step === "resultado" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                Sugestão gerada — {suggestions.length} produtos
              </h3>
              <Badge variant="outline">{totalSelected.length} selecionados • {totalUnits} unidades</Badge>
            </div>

            {explanation && (
              <p className="text-xs text-muted-foreground p-2 rounded bg-purple-500/5 border border-purple-500/20">
                💡 {explanation}
              </p>
            )}

            <div className="border border-border rounded-md max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Físico</TableHead>
                    <TableHead className="text-center">FULL</TableHead>
                    <TableHead className="text-center">Vendas 30d</TableHead>
                    <TableHead className="text-center w-24">Qtd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((s) => {
                    const critico = s.stock_full === 0 || s.stock_full < s.min_stock;
                    return (
                      <TableRow key={s.id} className={critico ? "bg-red-500/5" : ""}>
                        <TableCell>
                          <Checkbox checked={!!selected[s.id]} onCheckedChange={(v) => setSelected({ ...selected, [s.id]: !!v })} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {s.image_url ? <img src={s.image_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
                            <div className="min-w-0">
                              <p className="text-sm truncate flex items-center gap-1">
                                {s.name}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                                    <TooltipContent><p className="max-w-xs">{s.motivo}</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">{s.sku}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">{s.stock_physical}</TableCell>
                        <TableCell className="text-center text-sm">
                          <span className={critico ? "text-red-400 font-semibold" : ""}>{s.stock_full}</span>
                        </TableCell>
                        <TableCell className="text-center text-sm">{s.vendas_30d}</TableCell>
                        <TableCell className="text-center">
                          <Input type="number" min={1} value={s.qtd_sugerida}
                            onChange={(e) => updateQtd(s.id, parseInt(e.target.value) || 1)}
                            className="w-16 mx-auto h-8 text-center" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("perguntas")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Refazer sugestão
              </Button>
              <Button onClick={aplicar}>
                <Check className="h-4 w-4 mr-1" /> Usar esta lista
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
