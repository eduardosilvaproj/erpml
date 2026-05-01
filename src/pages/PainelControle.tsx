import { useEffect, useState } from "react";
import { useIsAdminMaster } from "@/hooks/useAdminMaster";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert, CheckCircle2, AlertTriangle, Bug, HelpCircle, ChevronDown, ChevronUp, Copy, History, Terminal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/hooks/useCompanyData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

type ModuleStatus = "OK" | "Parcial" | "Com bug" | "Não testado";

interface Module {
  id: string;
  name: string;
  status: ModuleStatus;
  lastTested: string | null;
  checklist: { item: string; done: boolean }[];
}

interface UpdateLog {
  timestamp: string;
  userEmail: string;
  moduleId: string;
  moduleName: string;
  oldStatus: ModuleStatus;
  newStatus: ModuleStatus;
}

const INITIAL_MODULES: Module[] = [
  { 
    id: "entrada-nota", name: "Entrada de Nota", status: "Não testado", lastTested: null,
    checklist: [
      { item: "subir XML", done: false },
      { item: "confirmar entrada atualiza stock_physical", done: false },
      { item: "item sem EAN vai para revisão", done: false },
      { item: "nota duplicada bloqueada", done: false },
      { item: "excluir nota reverte estoque", done: false }
    ]
  },
  { 
    id: "envio-full", name: "Envio FULL", status: "Não testado", lastTested: null,
    checklist: [
      { item: "carregar PDF", done: false },
      { item: "botão Executar aparece", done: false },
      { item: "bipagem conta corretamente", done: false },
      { item: "alerta ao exceder quantidade", done: false },
      { item: "GTIN CX reconhecido", done: false },
      { item: "finalizar baixa stock_physical e sobe stock_full", done: false },
      { item: "isolamento por empresa", done: false }
    ]
  },
  { id: "conferencia", name: "Conferência", status: "Não testado", lastTested: null, checklist: [{ item: "criar a partir de nota", done: false }, { item: "bipagem em tempo real", done: false }, { item: "histórico correto", done: false }, { item: "isolamento por empresa", done: false }] },
  { id: "estoque", name: "Controle de Estoque", status: "Não testado", lastTested: null, checklist: [{ item: "carrega em empresa nova", done: false }, { item: "saldo físico correto", done: false }, { item: "saldo FULL correto", done: false }, { item: "alerta de mínimo", done: false }, { item: "ajuste manual", done: false }, { item: "exportar", done: false }] },
  { id: "balanco", name: "Balanço", status: "Não testado", lastTested: null, checklist: [{ item: "sem divergências falsas", done: false }, { item: "divergência só em estoque abaixo do mínimo ou FULL negativo", done: false }] },
  { id: "cadastros", name: "Cadastros", status: "Não testado", lastTested: null, checklist: [{ item: "cadastrar produto", done: false }, { item: "editar EAN", done: false }, { item: "GTIN CX salvo", done: false }, { item: "kit com itens", done: false }, { item: "excluir com histórico bloqueado", done: false }, { item: "isolamento", done: false }] },
  { id: "kits", name: "Kits", status: "Não testado", lastTested: null, checklist: [] },
  { id: "vendas", name: "Vendas", status: "Não testado", lastTested: null, checklist: [] },
  { id: "dashboard", name: "Dashboard", status: "Não testado", lastTested: null, checklist: [] },
  { id: "transferencias", name: "Transferências", status: "Não testado", lastTested: null, checklist: [] },
  { id: "usuarios-empresas", name: "Usuários e Empresas", status: "Não testado", lastTested: null, checklist: [] },
  { id: "central-ia", name: "Central de IA", status: "Não testado", lastTested: null, checklist: [] }
];

export default function PainelControle() {
  const { data: isAdminMaster, isLoading: checkingRole } = useIsAdminMaster();
  const { data: company } = useMyCompany();
  const navigate = useNavigate();
  const [modules, setModules] = useState<Module[]>(INITIAL_MODULES);
  const [history, setHistory] = useState<UpdateLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  useEffect(() => {
    if (!checkingRole && isAdminMaster === false) {
      toast.error("Acesso não autorizado");
      navigate("/dashboard");
    }
  }, [isAdminMaster, checkingRole, navigate]);

  useEffect(() => {
    if (company?.id && isAdminMaster) {
      loadState();
    }
  }, [company?.id, isAdminMaster]);

  async function loadState() {
    try {
      const { data, error } = await supabase
        .from("admin_panel_state")
        .select("data")
        .eq("company_id", company!.id)
        .maybeSingle();

      if (error) throw error;
      if (data?.data) {
        const savedData = data.data as any;
        if (savedData.modules) setModules(savedData.modules);
        if (savedData.history) setHistory(savedData.history);
      }
    } catch (error) {
      console.error("Error loading state:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveState(updatedModules: Module[], updatedHistory: UpdateLog[]) {
    try {
      const { error } = await supabase
        .from("admin_panel_state")
        .upsert({
          company_id: company!.id,
          data: { modules: updatedModules, history: updatedHistory }
        }, { onConflict: "company_id" });

      if (error) throw error;
    } catch (error) {
      console.error("Error saving state:", error);
      toast.error("Erro ao salvar alterações");
    }
  }

  const handleStatusUpdate = (moduleId: string, newStatus: ModuleStatus) => {
    const { data: { user } } = (window as any).supabaseAuthSession || { data: { user: { email: 'user' } } };
    const userEmail = user?.email || "admin";

    const updatedModules = modules.map(m => {
      if (m.id === moduleId) {
        const oldStatus = m.status;
        if (oldStatus !== newStatus) {
          const newLog: UpdateLog = {
            timestamp: new Date().toISOString(),
            userEmail,
            moduleId,
            moduleName: m.name,
            oldStatus,
            newStatus
          };
          const newHistory = [newLog, ...history].slice(0, 50);
          setHistory(newHistory);
          return { ...m, status: newStatus, lastTested: new Date().toISOString() };
        }
      }
      return m;
    });

    setModules(updatedModules);
    saveState(updatedModules, history);
  };

  const handleChecklistToggle = (moduleId: string, itemIndex: number) => {
    const updatedModules = modules.map(m => {
      if (m.id === moduleId) {
        const newChecklist = [...m.checklist];
        newChecklist[itemIndex] = { ...newChecklist[itemIndex], done: !newChecklist[itemIndex].done };
        return { ...m, checklist: newChecklist };
      }
      return m;
    });
    setModules(updatedModules);
    saveState(updatedModules, history);
  };

  const generatePrompt = (type: 'bug' | 'feature' | 'safe' | 'deploy') => {
    const okModules = modules.filter(m => m.status === 'OK').map(m => m.name).join(', ');
    const restriction = okModules ? `\n\nRESTRIÇÃO: Não modifique ou quebre os seguintes módulos que estão com status OK: ${okModules}.` : "";
    
    let base = "";
    switch(type) {
      case 'bug': base = "Corrigir o seguinte bug: [DESCRIÇÃO]. Analise o impacto nos módulos dependentes."; break;
      case 'feature': base = "Implementar a nova funcionalidade: [DESCRIÇÃO]. Siga o padrão de design e arquitetura existente."; break;
      case 'safe': base = "Realizar alteração segura em: [DESCRIÇÃO]. Priorize retrocompatibilidade e performance."; break;
      case 'deploy': base = "Realizar checklist pré-deploy. Verifique isolamento por empresa, permissões RLS e logs de erro."; break;
    }

    const fullPrompt = `${base}${restriction}`;
    navigator.clipboard.writeText(fullPrompt);
    toast.success("Prompt copiado para o clipboard!");
  };

  if (checkingRole || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminMaster) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel de Controle Stovix</h1>
          <p className="text-muted-foreground text-lg">Governança, QA e Status do Sistema</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => generatePrompt('bug')}><Bug className="h-4 w-4 mr-2" /> Bug</Button>
          <Button variant="outline" size="sm" onClick={() => generatePrompt('feature')}><Terminal className="h-4 w-4 mr-2" /> Feature</Button>
          <Button variant="outline" size="sm" onClick={() => generatePrompt('safe')}><ShieldAlert className="h-4 w-4 mr-2" /> Safe</Button>
          <Button variant="outline" size="sm" onClick={() => generatePrompt('deploy')}><CheckCircle2 className="h-4 w-4 mr-2" /> Pre-Deploy</Button>
        </div>
      </div>

      <Tabs defaultValue="status" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="status">Status dos Módulos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {modules.map((m) => (
              <Card key={m.id} className="overflow-hidden border-border/40 hover:border-primary/20 transition-colors">
                <CardHeader className="p-4 pb-2 space-y-0">
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-sm font-bold truncate">{m.name}</CardTitle>
                    <StatusBadge status={m.status} />
                  </div>
                  <CardDescription className="text-[10px] flex items-center">
                    {m.lastTested ? `Último teste: ${format(new Date(m.lastTested), "dd/MM/yy HH:mm", { locale: ptBR })}` : "Ainda não testado"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="flex gap-1 mb-4 flex-wrap">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500 hover:bg-green-500/10" onClick={() => handleStatusUpdate(m.id, "OK")}><CheckCircle2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-yellow-500 hover:bg-yellow-500/10" onClick={() => handleStatusUpdate(m.id, "Parcial")}><AlertTriangle className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-500/10" onClick={() => handleStatusUpdate(m.id, "Com bug")}><Bug className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:bg-gray-400/10" onClick={() => handleStatusUpdate(m.id, "Não testado")}><HelpCircle className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => setExpandedModule(expandedModule === m.id ? null : m.id)}>
                      {expandedModule === m.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  {expandedModule === m.id && m.checklist.length > 0 && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-border/40 animate-in slide-in-from-top-2">
                      {m.checklist.map((item, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`${m.id}-${idx}`} 
                            checked={item.done} 
                            onCheckedChange={() => handleChecklistToggle(m.id, idx)} 
                            className="h-3.5 w-3.5"
                          />
                          <label htmlFor={`${m.id}-${idx}`} className={`text-[11px] leading-tight cursor-pointer ${item.done ? 'line-through text-muted-foreground' : ''}`}>
                            {item.item}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center"><History className="h-4 w-4 mr-2" /> Logs de Atualização</CardTitle>
              <CardDescription>Últimas 50 alterações de status realizadas no painel</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] w-full pr-4">
                <div className="space-y-4">
                  {history.length === 0 ? (
                    <p className="text-center py-10 text-muted-foreground">Nenhum histórico disponível.</p>
                  ) : (
                    history.map((log, i) => (
                      <div key={i} className="flex flex-col space-y-1 border-b border-border/40 pb-3 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary">{log.moduleName}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-muted-foreground">Usuário: {log.userEmail}</span>
                          <div className="flex items-center gap-1">
                            <StatusBadge status={log.oldStatus} size="sm" />
                            <ChevronDown className="h-3 w-3 -rotate-90 opacity-40" />
                            <StatusBadge status={log.newStatus} size="sm" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status, size = "md" }: { status: ModuleStatus; size?: "sm" | "md" }) {
  const config = {
    "OK": { color: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle2 },
    "Parcial": { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", icon: AlertTriangle },
    "Com bug": { color: "bg-red-500/10 text-red-500 border-red-500/20", icon: Bug },
    "Não testado": { color: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: HelpCircle }
  };
  
  const { color, icon: Icon } = config[status];
  const padding = size === "sm" ? "px-1 py-0" : "px-2 py-0.5";
  const fontSize = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <Badge variant="outline" className={`${color} ${padding} ${fontSize} font-bold flex items-center gap-1`}>
      <Icon className={size === "sm" ? "h-2 w-2" : "h-3 w-3"} />
      {status}
    </Badge>
  );
}
