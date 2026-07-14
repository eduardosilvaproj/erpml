import React from "react";
import { Layers, ChevronLeft, ChevronRight, Zap, AlertTriangle, ScanBarcode, CheckCircle, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { ConferenceItemRow } from "./ConferenceItemRow";
import { type ConferenceItem, type BatchNfe } from "../types";

interface StepConferenciaProps {
  isBatchMode: boolean;
  selectedBatchNfes: BatchNfe[];
  batchConferenceMode: "together" | "one_by_one" | null;
  currentBatchNfIdx: number;
  batchConferenceDoneCount: number;
  conferenceItems: ConferenceItem[];
  conferenceProgress: number;
  bipInput: string;
  setBipInput: (v: string) => void;
  bipRef: any;
  handleBip: (code: string) => void;
  bipAlert: { type: string; msg: string } | null;
  startBatchConference: (mode: "together" | "one_by_one") => void;
  loadNfConference: (idx: number) => void;
  finishCurrentNfConference: () => void;
  goToStep: (step: any) => void;
  setConferenceItems: React.Dispatch<React.SetStateAction<ConferenceItem[]>>;
  setCompletedSteps: React.Dispatch<React.SetStateAction<Set<number>>>;
  setCurrentStep: (s: any) => void;
  formatCurrency: (v: number) => string;
  flashIdx: number | null;
  setUnknownGtinDialog: (d: any) => void;
  setUnknownGtinProduct: (v: string) => void;
  setUnknownGtinQty: (v: number) => void;
  setUnknownGtinBoxes: (v: number) => void;
  setUnknownGtinSave: (v: boolean) => void;
}

export const StepConferencia = ({
  isBatchMode, selectedBatchNfes, batchConferenceMode, currentBatchNfIdx, batchConferenceDoneCount,
  conferenceItems, conferenceProgress, bipInput, setBipInput, bipRef, handleBip, bipAlert,
  startBatchConference, loadNfConference, finishCurrentNfConference, goToStep, setConferenceItems, setCompletedSteps, setCurrentStep, formatCurrency,
  flashIdx, setUnknownGtinDialog, setUnknownGtinProduct, setUnknownGtinQty, setUnknownGtinBoxes, setUnknownGtinSave
}: StepConferenciaProps) => {

  if (isBatchMode && !batchConferenceMode) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <Layers className="h-10 w-10 text-primary mx-auto" />
            <p className="text-lg font-bold">Como quer conferir este lote?</p>
            <p className="text-sm text-muted-foreground">{selectedBatchNfes.length} notas carregadas</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer border-2 hover:border-primary/50 transition-all"
            onClick={() => startBatchConference("together")}
          >
            <CardContent className="p-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-2xl">📋</span>
              </div>
              <p className="font-bold">Conferir todas juntas</p>
              <p className="text-xs text-muted-foreground">
                Todos os produtos de todas as notas aparecem numa lista única. Bipe qualquer produto de qualquer nota.
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-2 hover:border-primary/50 transition-all"
            onClick={() => startBatchConference("one_by_one")}
          >
            <CardContent className="p-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-2xl">📄</span>
              </div>
              <p className="font-bold">Conferir uma por uma</p>
              <p className="text-xs text-muted-foreground">
                Confira cada nota separadamente. Ao finalizar uma, avance para a próxima.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {isBatchMode && batchConferenceMode === "one_by_one" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">
                Nota {currentBatchNfIdx + 1} de {selectedBatchNfes.length} — {selectedBatchNfes[currentBatchNfIdx]?.nfeData.issuerName}
              </span>
              <Badge variant="secondary">{selectedBatchNfes[currentBatchNfIdx]?.nfeData.products.length} itens — {formatCurrency(selectedBatchNfes[currentBatchNfIdx]?.nfeData.totalValue || 0)}</Badge>
            </div>
            <Progress value={((currentBatchNfIdx + 1) / selectedBatchNfes.length) * 100} className="h-2" />
            <div className="flex justify-between mt-3">
              <Button variant="outline" size="sm" disabled={currentBatchNfIdx === 0} onClick={() => loadNfConference(currentBatchNfIdx - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> NF anterior
              </Button>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                {batchConferenceDoneCount} de {selectedBatchNfes.length} conferidas
              </Badge>
              <Button variant="outline" size="sm" disabled={currentBatchNfIdx >= selectedBatchNfes.length - 1} onClick={() => { finishCurrentNfConference(); }}>
                Próxima NF <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {conferenceItems.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                As quantidades serão confirmadas conforme a nota fiscal. Você pode ajustar depois pelo Balanço.
              </p>
            </div>
            <Button
              className="w-full bg-amber-500 hover:bg-amber-500/90 text-amber-950 font-semibold"
              onClick={() => {
                setConferenceItems((prev) =>
                  prev.map((ci) => ({ ...ci, scannedQty: ci.expectedQty, status: "ok" as const }))
                );
                setCompletedSteps((p) => new Set([...p, 2, 3]));
                goToStep(5);
              }}
            >
              <Zap className="h-4 w-4 mr-2" />
              Pular conferência e confirmar quantidade da nota
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Bipe ou digite o código de barras...</p>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <BarcodeScannerInput
                ref={bipRef}
                value={bipInput}
                onChange={(v) => setBipInput(v)}
                onScan={(code) => handleBip(code)}
                placeholder="Bipe ou digite o código de barras..."
                inputClassName="min-h-[48px] text-lg font-mono"
                icon={<ScanBarcode className="h-5 w-5" />}
                autoFocus
                scanMode
              />
            </div>
            <Button className="h-12" onClick={() => handleBip(bipInput)} disabled={!bipInput.trim()}>
              Bipar
            </Button>
          </div>
          {bipAlert && (
            <div className={`rounded-lg p-3 text-sm font-medium flex items-center gap-2 ${
              bipAlert.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
              bipAlert.type === "warning" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
              "bg-destructive/10 text-destructive border border-destructive/20"
            }`}>
              {bipAlert.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> :
               <AlertTriangle className="h-4 w-4 shrink-0" />}
              {bipAlert.msg}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso geral</span>
            <span className="font-bold">{conferenceProgress} de {conferenceItems.length} itens conferidos</span>
          </div>
          <div className="h-3 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${conferenceItems.length > 0 ? (conferenceProgress / conferenceItems.length) * 100 : 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {isBatchMode && batchConferenceMode === "together" && <TableHead className="w-[80px]">NF</TableHead>}
              <TableHead className="w-[40px]" />
              <TableHead className="w-[50px]">Foto</TableHead>
              <TableHead>Nome do produto</TableHead>
              <TableHead>SKU / Código</TableHead>
              <TableHead className="text-center">Qtd Nota</TableHead>
              <TableHead className="text-center w-[130px]">Qtd Conferida</TableHead>
              <TableHead className="text-center w-[120px]">Progresso</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conferenceItems.map((item, i) => (
              <ConferenceItemRow
                key={i}
                item={item}
                index={i}
                flashIdx={flashIdx}
                isBatchModeTogether={isBatchMode && batchConferenceMode === "together"}
                onQtyChange={(newQty) => {
                  setConferenceItems((prev) => {
                    const updated = [...prev];
                    const ci = { ...updated[i], scannedQty: newQty };
                    ci.status = ci.scannedQty === 0 ? "pending" : ci.scannedQty === ci.expectedQty ? "ok" : ci.scannedQty > ci.expectedQty ? "excess" : "partial";
                    updated[i] = ci;
                    return updated;
                  });
                }}
                onBoxClick={() => {
                  setUnknownGtinDialog({ code: "" });
                  setUnknownGtinProduct(`idx-${i}`);
                  setUnknownGtinQty(item.matchedProductBoxQty || 1);
                  setUnknownGtinBoxes(1);
                  setUnknownGtinSave(true);
                }}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{conferenceProgress} de {conferenceItems.length} itens conferidos</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { if (isBatchMode) { startBatchConference(null as any); } else { setCurrentStep(1); } }}>
            Voltar
          </Button>
          <Button
            onClick={() => {
              const hasDivergences = conferenceItems.some((i) => i.status !== "ok");
              goToStep(hasDivergences ? 3 : 4);
            }}
            disabled={conferenceProgress < conferenceItems.length}
          >
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
};
