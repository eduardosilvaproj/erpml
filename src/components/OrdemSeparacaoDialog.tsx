import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ScanBarcode, Video, Square, Circle, CheckCircle2, AlertTriangle, Loader2, Play, Printer, Box, Clock, Calendar, ArrowRight, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyId } from "@/hooks/useCompanyId";
import {
  useOrdemFull, useUpdateItemQuantity, useUpdateOrdemStatus, useMarcarOrdemSeparada, useMarcarOrdemEnviada,
  itemStatusBadge, ordemStatusBadge, type OrdemItem, useUpdateFullOrder
} from "@/hooks/useOrdensFull";
import { useFullRecorder, formatDuration } from "@/hooks/useFullRecorder";
import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { useNavigate } from "react-router-dom";
import { OrderRecordingSystem } from "@/components/OrderRecordingSystem";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  ordemId: string | null;
  onClose: () => void;
}

export const OrdemSeparacaoDialog = ({ ordemId, onClose }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const companyId = useCompanyId();
  const { data, isLoading, refetch } = useOrdemFull(ordemId);
  const updateItem = useUpdateItemQuantity();
  const updateStatus = useUpdateOrdemStatus();
  const marcarSeparada = useMarcarOrdemSeparada();
  const marcarEnviada = useMarcarOrdemEnviada();
  const updateFullOrder = useUpdateFullOrder();
  const recorder = useFullRecorder();

  const [askRecord, setAskRecord] = useState(false);
  const [pickCamera, setPickCamera] = useState(false);
  const [selCam, setSelCam] = useState<string>("");
  const [scan, setScan] = useState("");
  const [lastScan, setLastScan] = useState<{ ok: boolean; msg: string } | null>(null);

  const ordem = data?.ordem;
  const itens = data?.itens || [];
  const isExec = ordem?.status === "em_separacao";
  const isSeparada = ordem?.status === "separada" || ordem?.status === "aguardando_carregamento";
  const isView = ordem?.status === "concluida" || ordem?.status === "enviado" || ordem?.status === "cancelada" || isSeparada;

  useEffect(() => {
    if (!ordemId) {
      setAskRecord(false); setPickCamera(false); setSelCam(""); setScan(""); setLastScan(null);
      if (recorder.status !== "idle") recorder.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordemId]);

  const progress = useMemo(() => {
    const total = itens.reduce((s, i) => s + i.qtd_solicitada, 0);
    const sep = itens.reduce((s, i) => s + Math.min(i.qtd_separada, i.qtd_solicitada), 0);
    const completos = itens.filter((i) => i.status === "completo").length;
    return { total, sep, completos, pct: total > 0 ? Math.round((sep / total) * 100) : 0 };
  }, [itens]);

  const allComplete = itens.length > 0 && itens.every((i) => i.status === "completo");

  const handleStart = () => setAskRecord(true);

  const startWithoutRecording = async () => {
    setAskRecord(false);
    if (!ordem) return;
    await updateStatus.mutateAsync({ id: ordem.id, status: "em_separacao" });
    refetch();
  };

  const startWithRecording = async () => {
    setAskRecord(false);
    const list = await recorder.listCameras();
    if (list.length === 0) {
      toast({ title: "Sem câmera detectada", variant: "destructive" });
      return;
    }
    setSelCam(list[0].deviceId);
    setPickCamera(true);
  };

  const confirmStartRecording = async () => {
    setPickCamera(false);
    if (!ordem) return;
    await recorder.start(selCam);
    await updateStatus.mutateAsync({ id: ordem.id, status: "em_separacao" });
    refetch();
  };

  const handleScan = async (code: string) => {
    if (!code.trim() || !isExec) return;
    const target = itens.find((i) =>
      i.product?.barcode === code.trim() || i.product?.sku === code.trim()
    );
    if (!target) {
      setLastScan({ ok: false, msg: `Produto "${code}" não está nesta ordem` });
      return;
    }
    const newQtd = target.qtd_separada + 1;
    if (newQtd > target.qtd_solicitada) {
      setLastScan({ ok: false, msg: `Excesso! ${target.product?.name} (${newQtd}/${target.qtd_solicitada})` });
    } else {
      setLastScan({ ok: true, msg: `${target.product?.name} — ${newQtd}/${target.qtd_solicitada}` });
    }
    await updateItem.mutateAsync({
      itemId: target.id,
      qtd_separada: newQtd,
      qtd_solicitada: target.qtd_solicitada,
    });
    refetch();
    setScan("");
  };

  const finalizar = async () => {
    if (!ordem || !user || !companyId) return;
    if (!allComplete && !confirm("Existem itens pendentes/parciais. Marcar como separada mesmo assim?")) return;
    try {
      // Para gravação se ativa
      if (recorder.status === "recording" || recorder.status === "paused") {
        const blob = await recorder.stop();
        if (blob) {
          await recorder.uploadAndSave({
            blob, companyId, userId: user.id,
            envioId: ordem.id, orderNumber: ordem.numero,
            tipo: "separacao",
            duracaoSegundos: recorder.seconds,
          });
        }
      }
      await marcarSeparada.mutateAsync(ordem.id);
      toast({ title: "✅ Separação concluída!", description: "Produtos carregados para envio." });
      onClose();
      navigate("/movimentacao-full");
    } catch (e: any) {
      toast({ title: "Erro ao concluir", description: e.message, variant: "destructive" });
    }
  };

  const marcarComoEnviado = async () => {
    if (!ordem || !user || !companyId) return;
    try {
      if (recorder.status === "recording" || recorder.status === "paused") {
        const blob = await recorder.stop();
        if (blob) {
          await recorder.uploadAndSave({
            blob, companyId, userId: user.id,
            envioId: ordem.id, orderNumber: ordem.numero,
            tipo: "separacao",
            duracaoSegundos: recorder.seconds,
          });
        }
      }
      await marcarEnviada.mutateAsync(ordem.id);
      toast({ title: "✅ Ordem enviada!", description: "A ordem foi marcada como enviada ao FULL." });
      onClose();
      navigate("/movimentacao-full");
    } catch (e: any) {
      toast({ title: "Erro ao marcar como enviado", description: e.message, variant: "destructive" });
    }
  };

  const ajustarQtd = async (item: OrdemItem, delta: number) => {
    const newQtd = Math.max(0, item.qtd_separada + delta);
    await updateItem.mutateAsync({
      itemId: item.id,
      qtd_separada: newQtd,
      qtd_solicitada: item.qtd_solicitada,
    });
    refetch();
  };

  if (!ordemId) return null;

  return (
    <>
      <Dialog open={!!ordemId} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Ordem #{ordem?.frete_ml || ordem?.numero}</span>
              {ordem && <Badge variant="outline" className={ordemStatusBadge(ordem.status).cls}>{ordemStatusBadge(ordem.status).label}</Badge>}
              {recorder.status === "recording" && (
                <Badge variant="outline" className="bg-destructive/15 text-destructive animate-pulse ml-auto">
                  <Circle className="h-2 w-2 mr-1 fill-current" /> REC {formatDuration(recorder.seconds)}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>{ordem?.descricao || "Sem descrição"}</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : !ordem ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Ordem não encontrada</p>
          ) : (
            <div className="space-y-4">
              {/* Progresso */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{progress.completos} de {itens.length} produtos completos</span>
                  <span className="font-medium">{progress.sep}/{progress.total} unidades ({progress.pct}%)</span>
                </div>
                <Progress value={progress.pct} className="h-2" />
              </div>

              {/* Alerta de conclusão e ação rápida */}
              {allComplete && (isExec || isSeparada) && (
                <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-lg p-4 flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Bipagem concluída!</p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">Todos os itens desta ordem foram bipados com sucesso.</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={marcarComoEnviado}
                    disabled={marcarEnviada.isPending}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-sm"
                  >
                    {marcarEnviada.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Marcar como enviado
                  </Button>
                </div>
              )}

              {/* Iniciar */}
              {ordem.status === "aguardando" && (
                <div className="text-center py-4">
                  <Button size="lg" onClick={handleStart}>
                    <Play className="h-4 w-4 mr-2" /> Iniciar separação
                  </Button>
                </div>
              )}

              {/* Bipagem */}
              {isExec && (
                <div className="flex flex-col lg:grid lg:grid-cols-[1fr,300px] gap-4">
                  <div className="space-y-3 order-2 lg:order-1 min-w-0">
                    <ItensTable itens={itens} onAdjust={ajustarQtd} />
                  </div>
                  <div className="space-y-3 order-1 lg:order-2 min-w-0 lg:border-l-0 border-b lg:border-b-0 border-border pb-3 lg:pb-0">
                    <div className="border border-border rounded-md p-3 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2"><ScanBarcode className="h-4 w-4" /> Bipar produto</p>
                      <BarcodeScannerInput
                        value={scan}
                        onChange={setScan}
                        onScan={handleScan}
                        placeholder="Bipe o código..."
                        autoFocus
                        scanMode
                      />
                      {lastScan && (
                        <div className={`text-xs p-2 rounded break-words ${lastScan.ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                          {lastScan.ok ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <AlertTriangle className="h-3 w-3 inline mr-1" />}
                          {lastScan.msg}
                        </div>
                      )}
                    </div>
                    {recorder.status === "recording" && (
                      <video ref={recorder.videoRef} className="w-full rounded-md border border-border bg-black aspect-video" />
                    )}
                  </div>
                </div>
              )}

              {/* Visualização (concluída/cancelada) */}
              {isView && <ItensTable itens={itens} readonly />}
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-3">
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Fechar</Button>
            {isExec && (
              <Button onClick={finalizar} disabled={marcarSeparada.isPending} className="w-full sm:w-auto">
                {marcarSeparada.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir separação
              </Button>
            )}
            {isSeparada && (
              <Button onClick={marcarComoEnviado} disabled={marcarEnviada.isPending} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-none">
                {marcarEnviada.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar como enviado
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pergunta gravação */}
      <Dialog open={askRecord} onOpenChange={setAskRecord}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deseja gravar esta separação?</DialogTitle>
            <DialogDescription>A gravação ajuda em auditorias e disputas.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button onClick={startWithRecording}>
              <Video className="h-4 w-4 mr-2" /> Gravar e iniciar
            </Button>
            <Button variant="outline" onClick={startWithoutRecording}>Iniciar sem gravação</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Picker de câmera */}
      <Dialog open={pickCamera} onOpenChange={setPickCamera}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecionar câmera</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {recorder.cameras.map((c) => (
              <Button key={c.deviceId} variant={selCam === c.deviceId ? "default" : "outline"} className="w-full justify-start" onClick={() => setSelCam(c.deviceId)}>
                {c.label}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickCamera(false)}>Cancelar</Button>
            <Button onClick={confirmStartRecording} disabled={!selCam}>
              <Video className="h-4 w-4 mr-1" /> Começar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ItensTable = ({ itens, onAdjust, readonly }: { itens: OrdemItem[]; onAdjust?: (i: OrdemItem, d: number) => void; readonly?: boolean }) => (
  <div className="border border-border rounded-md overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead className="text-center">Solicitado</TableHead>
          <TableHead className="text-center">Bipado</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {itens.map((i) => {
          const sb = itemStatusBadge(i.status);
          return (
            <TableRow key={i.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {i.product?.image_url ? <img src={i.product.image_url} alt="" className="h-9 w-9 rounded object-cover" /> : <div className="h-9 w-9 rounded bg-muted" />}
                  <div className="min-w-0">
                    <p className="text-sm truncate">{i.product?.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{i.product?.sku}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center font-medium">{i.qtd_solicitada}</TableCell>
              <TableCell className="text-center">
                {!readonly && onAdjust ? (
                  <div className="flex items-center justify-center gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onAdjust(i, -1)}>−</Button>
                    <span className="font-medium w-8">{i.qtd_separada}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onAdjust(i, +1)}>+</Button>
                  </div>
                ) : (
                  <span className="font-medium">{i.qtd_separada}</span>
                )}
              </TableCell>
              <TableCell><Badge variant="outline" className={sb.cls}>{sb.label}</Badge></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>
);
