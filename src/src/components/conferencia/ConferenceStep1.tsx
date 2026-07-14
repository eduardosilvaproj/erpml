import { FileText, ClipboardList, Package, History, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConferenceHistoryPanel } from "@/components/ConferenceHistoryPanel";
import { ConferenceMode, ConferenceType } from "./types";

interface ConferenceStep1Props {
  mode: ConferenceMode;
  setMode: (mode: ConferenceMode) => void;
  conferenceType: ConferenceType;
  setConferenceType: (type: ConferenceType) => void;
  conferenceName: string;
  setConferenceName: (name: string) => void;
  sectionName: string;
  setSectionName: (name: string) => void;
  onStart: () => void;
  onContinue: (conference: any) => Promise<void>;
}

export const ConferenceStep1 = ({
  mode,
  setMode,
  conferenceType,
  setConferenceType,
  conferenceName,
  setConferenceName,
  sectionName,
  setSectionName,
  onStart,
  onContinue
}: ConferenceStep1Props) => {
  return (
    <div className="space-y-6">
      <ConferenceHistoryPanel onContinue={onContinue} />
      
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <button
          onClick={() => setMode("nf")}
          className={`p-6 rounded-xl border-2 text-left transition-all ${
            mode === "nf"
              ? "border-primary bg-primary/5"
              : "border-border/40 hover:border-primary/30 bg-card/60"
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">Conferência por Nota Fiscal</p>
              <p className="text-xs text-muted-foreground">Confere produtos de uma NF específica</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            setMode("inventario");
            if (conferenceType !== "partial") setConferenceType("full");
          }}
          className={`p-6 rounded-xl border-2 text-left transition-all ${
            mode === "inventario" && conferenceType === "full"
              ? "border-primary bg-primary/5"
              : "border-border/40 hover:border-primary/30 bg-card/60"
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-xl bg-amber-500/10 p-3">
              <ClipboardList className="h-8 w-8 text-amber-400" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">Inventário Geral</p>
              <p className="text-xs text-muted-foreground">Confere todo o estoque</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            setMode("inventario");
            setConferenceType("partial");
          }}
          className={`p-6 rounded-xl border-2 text-left transition-all ${
            mode === "inventario" && conferenceType === "partial"
              ? "border-amber-500 bg-amber-500/5"
              : "border-border/40 hover:border-amber-500/30 bg-card/60"
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-xl bg-amber-500/10 p-3">
              <Package className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">Inventário Parcial</p>
              <p className="text-xs text-muted-foreground">Confere uma seção específica</p>
            </div>
          </div>
        </button>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground block">Nome da conferência</label>
            <Input
              value={conferenceName}
              onChange={(e) => setConferenceName(e.target.value)}
              placeholder="Ex: Inventário Abril 2026"
            />
          </div>

          {mode === "inventario" && conferenceType === "partial" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-medium text-amber-500 block flex items-center gap-1">
                <History className="h-3 w-3" /> Identificação da seção
              </label>
              <Input
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="Ex: Corredor 1, Prateleira A, Depósito 2"
                className="border-amber-500/30 focus-visible:ring-amber-500/30"
              />
              <p className="text-[10px] text-muted-foreground">Use para organizar bipagens por local físico.</p>
            </div>
          )}

          <Button 
            className={`w-full ${mode === "inventario" && conferenceType === "partial" ? "bg-amber-500 hover:bg-amber-600" : ""}`} 
            onClick={onStart} 
            disabled={!mode || (conferenceType === "partial" && !sectionName.trim())}
          >
            Iniciar conferência <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
