import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, CreditCard, History, StickyNote, ArrowUpRight, ArrowDownRight, AlertCircle, Search, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const BillingPanel = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isPlanChangeOpen, setIsPlanChangeOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [newPlanId, setNewPlanId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: plans } = useQuery({
    queryKey: ["governance-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    }
  });

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["governance-billing", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("subscriptions")
        .select(`
          *,
          companies (name),
          plans (name)
        `)
        .order("created_at", { ascending: false });
      
      if (searchTerm) {
        query = query.ilike("companies.name", `%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: eventHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["subscription-history-combined", selectedSub?.id],
    queryFn: async () => {
      if (!selectedSub?.id) return [];
      
      const [events, planHistory] = await Promise.all([
        supabase.from("subscription_events").select("*").eq("subscription_id", selectedSub.id).order("created_at", { ascending: false }),
        supabase.from("subscription_history").select("*, old_plan:old_plan_id(name), new_plan:new_plan_id(name)").eq("subscription_id", selectedSub.id).order("changed_at", { ascending: false })
      ]);

      const combined = [
        ...(events.data || []).map(e => ({ ...e, type: 'event', date: e.created_at })),
        ...(planHistory.data || []).map(h => ({ ...h, type: 'plan_change', date: h.changed_at }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return combined;
    },
    enabled: !!selectedSub?.id && isHistoryOpen,
  });

  const updatePlanMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSub || !newPlanId) return;
      const plan = plans?.find(p => p.id === newPlanId);
      if (!plan) return;

      const { error } = await supabase
        .from("subscriptions")
        .update({ 
          plan_id: newPlanId,
          value: plan.price,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedSub.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plano atualizado com sucesso");
      setIsPlanChangeOpen(false);
      queryClient.invalidateQueries({ queryKey: ["governance-billing"] });
    },
    onError: (error: any) => toast.error("Erro: " + error.message)
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedSub) return;
      const { error } = await supabase.from("subscription_notes").insert({
        subscription_id: selectedSub.id,
        author_id: user.id,
        content: noteContent
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota adicionada com sucesso");
      setIsNoteOpen(false);
      setNoteContent("");
      queryClient.invalidateQueries({ queryKey: ["governance-billing"] });
    },
    onError: (error: any) => toast.error("Erro: " + error.message)
  });

  const getInadimplenciaStatus = (dueDate: string, status: string) => {
    if (status === "active" || status === "CONFIRMED") return null;
    const days = differenceInDays(new Date(), new Date(dueDate));
    if (days <= 0) return null;
    if (days <= 5) return { label: "Atraso Recente", color: "text-amber-500", days };
    if (days <= 15) return { label: "Cobrança Ativa", color: "text-orange-500", days };
    return { label: "Risco de Churn", color: "text-red-600", days };
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Gestão de Cobranças SaaS</CardTitle>
            <CardDescription>Acompanhamento comercial e financeiro</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions?.map((sub) => {
                  const inadimplencia = getInadimplenciaStatus(sub.next_due_date, sub.status);
                  return (
                    <TableRow key={sub.id} className={inadimplencia ? "bg-amber-50/30" : ""}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{(sub.companies as any)?.name}</span>
                          {inadimplencia && (
                            <span className={`text-[10px] font-bold flex items-center gap-1 ${inadimplencia.color}`}>
                              <AlertCircle className="h-3 w-3" />
                              {inadimplencia.label} ({inadimplencia.days}d)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{(sub.plans as any)?.name || "—"}</TableCell>
                      <TableCell>{formatCurrency(Number(sub.value))}</TableCell>
                      <TableCell>{sub.next_due_date ? format(new Date(sub.next_due_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={sub.status === "active" || sub.status === "CONFIRMED" ? "default" : "secondary"}>
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" title="Mudar Plano" onClick={() => { setSelectedSub(sub); setNewPlanId(sub.plan_id); setIsPlanChangeOpen(true); }}>
                          <ArrowUpRight className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Notas" onClick={() => { setSelectedSub(sub); setIsNoteOpen(true); }}>
                          <StickyNote className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Histórico" onClick={() => { setSelectedSub(sub); setIsHistoryOpen(true); }}>
                          <History className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Detalhes">
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Histórico e Timeline */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico e Timeline - {(selectedSub?.companies as any)?.name}</DialogTitle>
            <DialogDescription>Eventos financeiros e mudanças comerciais</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[500px] overflow-y-auto space-y-4">
            {isLoadingHistory ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : eventHistory && eventHistory.length > 0 ? (
              <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                {eventHistory.map((item: any) => (
                  <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      {item.type === 'plan_change' ? <ArrowUpRight className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 bg-white shadow">
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-slate-900 text-xs">
                          {item.type === 'plan_change' ? 'Alteração de Plano' : item.event_type}
                        </div>
                        <time className="text-xs font-medium text-indigo-500">
                          {format(new Date(item.date), "dd/MM/yy HH:mm")}
                        </time>
                      </div>
                      <div className="text-slate-500 text-xs">
                        {item.type === 'plan_change' ? (
                          <>De <span className="font-semibold">{item.old_plan?.name}</span> para <span className="font-semibold">{item.new_plan?.name}</span></>
                        ) : (
                          <>Valor: {formatCurrency(item.amount)} | Status: {item.status}</>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Nenhum evento registrado.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Upgrade/Downgrade */}
      <Dialog open={isPlanChangeOpen} onOpenChange={setIsPlanChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alteração de Plano</DialogTitle>
            <DialogDescription>Mude o plano atual da empresa</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Novo Plano</label>
              <Select value={newPlanId} onValueChange={setNewPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {formatCurrency(plan.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSub && newPlanId && newPlanId !== selectedSub.plan_id && (
              <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  O valor da assinatura será atualizado para {formatCurrency(plans?.find(p => p.id === newPlanId)?.price || 0)}.
                  Uma entrada será gerada no histórico de mudanças.
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlanChangeOpen(false)}>Cancelar</Button>
            <Button onClick={() => updatePlanMutation.mutate()} disabled={updatePlanMutation.isPending || newPlanId === selectedSub?.plan_id}>
              Confirmar Alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nota Administrativa */}
      <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nota Administrativa / Follow-up</DialogTitle>
            <DialogDescription>Registre ações de cobrança ou observações comerciais</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder="Ex: Cliente prometeu pagamento para amanhã..." 
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNoteOpen(false)}>Cancelar</Button>
            <Button onClick={() => addNoteMutation.mutate()} disabled={!noteContent || addNoteMutation.isPending}>
              Salvar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
