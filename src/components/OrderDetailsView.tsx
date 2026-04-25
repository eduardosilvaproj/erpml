import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  Printer, 
  Clock, 
  Calendar, 
  Truck, 
  Box, 
  Loader2,
  ArrowLeft,
  Video
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  useOrdemFull, 
  useMarcarOrdemEnviada, 
  ordemStatusBadge,
  type OrdemFull 
} from "@/hooks/useOrdensFull";
import { OrderRecordingSystem } from "@/components/OrderRecordingSystem";

interface OrderDetailsViewProps {
  ordemId: string | null;
  onClose: () => void;
}

export function OrderDetailsView({ ordemId, onClose }: OrderDetailsViewProps) {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useOrdemFull(ordemId);
  const marcarEnviada = useMarcarOrdemEnviada();
  const [responsavelNome, setResponsavelNome] = useState<string | null>(null);
  
  const ordem = data?.ordem;

  useEffect(() => {
    if (ordem) {
      if (ordem.separado_por_profile?.full_name) {
        setResponsavelNome(ordem.separado_por_profile.full_name);
      } else if (ordem.atribuido?.full_name) {
        setResponsavelNome(ordem.atribuido.full_name);
      } else if (ordem.separado_por) {
        setResponsavelNome("Usuário " + ordem.separado_por.slice(0, 8));
      } else {
        setResponsavelNome("Administrador");
      }
    }
  }, [ordem]);

  const handleMarcarEnviado = async () => {
    if (!ordem) return;
    try {
      await marcarEnviada.mutateAsync(ordem.id);
      toast({ title: "✅ Ordem marcada como enviada!" });
      onClose();
    } catch (err: any) {
      toast({ title: "Erro ao marcar como enviado", description: err.message, variant: "destructive" });
    }
  };

  const handleImprimirRelatorio = async () => {
    if (!ordem || !data?.itens) return;

    const itens = data.itens;
    
    const html = `
      <html><head>
      <style>
        body { font-family: Arial; padding: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
        th { background: #f0f0f0; }
        .header { margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        h2 { margin: 0; color: #333; }
        .meta { font-size: 14px; color: #666; margin-top: 5px; }
      </style>
      </head><body>
        <div class="header">
          <h2>Relatório de Separação — Frete #${ordem.frete_ml || ordem.numero}</h2>
          <p class="meta">
            Data: ${ordem.separado_em ? format(new Date(ordem.separado_em), "dd/MM/yyyy HH:mm") : 'N/A'} | 
            Responsável: ${responsavelNome || 'Administrador'} | 
            ${ordem.total_produtos} produtos · ${ordem.total_itens} unidades
          </p>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>EAN</th>
              <th>SKU</th>
              <th>Nome no Sistema</th>
              <th>Qtd</th>
            </tr>
          </thead>
          <tbody>
            ${itens.map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${item.product?.barcode || '-'}</td>
                <td>${item.product?.sku || '-'}</td>
                <td>${item.product?.name || 'Produto não encontrado'}</td>
                <td>${item.qtd_solicitada}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body></html>
    `;
    
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 250);
    }
  };


  if (!ordemId) return null;

  return (
    <Dialog open={!!ordemId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto p-0">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-muted-foreground">Carregando detalhes...</p>
          </div>
        ) : !ordem ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">Ordem não encontrada.</p>
            <Button variant="outline" onClick={onClose} className="mt-4">Fechar</Button>
          </div>
        ) : (
          <>
            <div className="bg-gray-50 border-b p-6">
              <StatusBar currentStatus={ordem.status} />
            </div>

            <div className="p-6 space-y-6">
              <DialogHeader>
                <DialogTitle className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-primary">Frete #{ordem.frete_ml || "—"}</span>
                    <Badge variant="outline" className={`${ordemStatusBadge(ordem.status).cls} px-3 py-1 text-xs font-bold uppercase`}>
                      {ordem.status === 'aguardando_carregamento' ? '🚛 Aguardando Carregamento' : ordemStatusBadge(ordem.status).label}
                    </Badge>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground uppercase">ID Interno: {(ordem as any)?.ordem_id || ordem.numero}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-6">
                {/* Previsão de Coleta */}
                <PrevisaoColeta 
                  orderId={ordem.id}
                  freteId={ordem.frete_ml}
                  value={ordem.previsao_carregamento} 
                  onUpdate={refetch}
                />

                {/* Resumo */}
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-4 py-2 border-b">
                    <h3 className="text-sm font-black flex items-center gap-2 text-gray-700">
                      <Box className="h-4 w-4" /> RESUMO DA ORDEM
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                            <Box className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground leading-none mb-1">Total Separado</p>
                            <p className="text-lg font-black text-gray-900">
                              {ordem.total_produtos} produtos · {ordem.total_itens} unidades
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-amber-50 rounded-full text-amber-600">
                            <Clock className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground leading-none mb-1">Data de Separação</p>
                            <p className="text-base font-bold text-gray-900">
                              {ordem.separado_em ? format(new Date(ordem.separado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "Não registrada"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
                            <CheckCircle2 className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground leading-none mb-1">Responsável</p>
                            <p className="text-base font-bold text-gray-900">
                              {responsavelNome || "Administrador"}
                            </p>
                          </div>

                        </div>

                        <div className="flex-1" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gravação */}
                <div className="space-y-4">
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" /> 🚛 GRAVAÇÃO DO CARREGAMENTO
                  </h3>
                  <div className="p-6 border-2 border-dashed rounded-2xl bg-muted/20">
                    <OrderRecordingSystem 
                      pedidoId={ordem.id}
                      freteMl={ordem.frete_ml}
                      orderNumber={ordem.numero}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 p-6 border-t bg-gray-50/50">
              <div className="flex gap-3 w-full sm:w-auto">
                <Button variant="outline" onClick={handleImprimirRelatorio} className="gap-2 h-11">
                  <Printer className="h-5 w-5" /> Imprimir Relatório
                </Button>
                <Button variant="outline" onClick={onClose} className="gap-2 h-11">
                  <ArrowLeft className="h-4 w-4" /> Fechar
                </Button>
              </div>

              <Button 
                onClick={handleMarcarEnviado} 
                disabled={marcarEnviada.isPending} 
                className="w-full sm:w-auto gap-2 h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-tight shadow-lg shadow-emerald-500/20"
              >
                {marcarEnviada.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle2 className="h-5 w-5" /> Marcar como Enviado
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBar({ currentStatus }: { currentStatus: string }) {
  const steps = [
    { label: 'PDF', icon: Box, active: true },
    { label: 'Separado', icon: CheckCircle2, active: ['separada', 'aguardando_carregamento', 'carregando', 'enviado', 'concluida'].includes(currentStatus) },
    { label: 'Carregamento', icon: Truck, active: ['carregando', 'enviado', 'concluida'].includes(currentStatus) },
    { label: 'Enviado', icon: CheckCircle2, active: ['enviado', 'concluida'].includes(currentStatus) }
  ];

  return (
    <div className="flex items-center justify-between max-w-2xl mx-auto">
      {steps.map((step, idx) => (
        <div key={step.label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center relative">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs z-10 border-2 transition-all ${
              step.active 
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' 
                : 'bg-white border-gray-200 text-gray-400'
            }`}>
              <step.icon className="h-4 w-4" />
            </div>
            <span className={`text-[10px] mt-1 font-bold uppercase ${step.active ? 'text-emerald-600' : 'text-gray-400'}`}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 -mt-4 transition-all ${
              steps[idx+1].active ? 'bg-emerald-500' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

function PrevisaoColeta({ orderId, freteId, value, onUpdate }: { orderId: string, freteId: string | null, value: string | null | undefined, onUpdate: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState("");

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setData(format(d, "yyyy-MM-dd"));
    }
  }, [value]);

  const handleSave = async () => {
    try {
      const novaData = data;
      
      const { error: e1 } = await supabase
        .from('ordens_full')
        .update({ previsao_carregamento: novaData })
        .eq('id', orderId);
        
      if (freteId) {
        await supabase
          .from('full_orders')
          .update({ previsao_carregamento: novaData })
          .eq('frete_ml', freteId);
      }

      if (e1) throw e1;
      
      toast({ title: '✅ Previsão atualizada' });
      setEditing(false);
      onUpdate();
    } catch (e: any) {
      toast({ title: "Erro ao salvar previsão", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
      <div className="flex items-center gap-2 text-blue-800 font-bold mb-3">
        <Calendar className="h-5 w-5" />
        <span>📅 Previsão de coleta:</span>
      </div>
      
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input 
            type="date" 
            className="w-40 bg-white" 
            value={data} 
            onChange={(e) => setData(e.target.value)}
          />
          <Button size="sm" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Salvar</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-blue-900 bg-white px-3 py-1 rounded border shadow-sm">
            {value && !isNaN(new Date(value).getTime()) ? format(new Date(value), "dd/MM/yyyy") : "—"}
          </span>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
            ✏️ Editar
          </Button>
        </div>
      )}
    </div>
  );
}
