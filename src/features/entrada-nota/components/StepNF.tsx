import { useState, useRef } from "react";
import { Bot, Search, FileText, Plus, Trash2, Loader2, CheckCircle, AlertTriangle, Upload, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { type SefazEntry, type BatchNfe } from "../types";

interface StepNFProps {
  nfMode: "sefaz" | "xml";
  setNfMode: (m: "sefaz" | "xml") => void;
  sefazEntries: SefazEntry[];
  updateSefazEntry: (id: string, field: "number" | "series", value: string) => void;
  removeSefazEntry: (id: string) => void;
  addSefazEntry: () => void;
  handleSefazSearch: () => void;
  loading: boolean;
  batchSearchProgress: { current: number; total: number };
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleBatchDrop: (e: React.DragEvent) => void;
  handleBatchXmlUpload: (files: FileList | File[]) => void;
  batchNfes: BatchNfe[];
  setBatchNfes: React.Dispatch<React.SetStateAction<BatchNfe[]>>;
  setNfeData: (d: any) => void;
  setMatches: (m: any) => void;
  goToStep: (s: any) => void;
  formatCurrency: (v: number) => string;
}

export const StepNF = ({
  nfMode, setNfMode, sefazEntries, updateSefazEntry, removeSefazEntry, addSefazEntry,
  handleSefazSearch, loading, batchSearchProgress, dragOver, setDragOver,
  handleBatchDrop, handleBatchXmlUpload, batchNfes, setBatchNfes, setNfeData, setMatches, goToStep, formatCurrency
}: StepNFProps) => {
  const batchFileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Assistente de Importação</p>
          <p className="text-xs text-muted-foreground mt-1">
            Importe uma ou várias notas. O sistema detecta automaticamente se é entrada única ou em lote.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={nfMode === "sefaz" ? "default" : "outline"}
          className="flex-1 min-h-[44px] gap-2"
          onClick={() => setNfMode("sefaz")}
        >
          <Search className="h-4 w-4" />
          Buscar na SEFAZ
        </Button>
        <Button
          variant={nfMode === "xml" ? "default" : "outline"}
          className="flex-1 min-h-[44px] gap-2"
          onClick={() => setNfMode("xml")}
        >
          <FileText className="h-4 w-4" />
          Upload XML
        </Button>
      </div>

      {nfMode === "sefaz" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Chave de Acesso ou Número da Nota</p>
              <p className="text-xs text-muted-foreground">Informe os 44 dígitos da chave ou apenas o número da NF para buscar no sistema.</p>
            </div>
            {sefazEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <BarcodeScannerInput
                    value={entry.number}
                    onChange={(v) => updateSefazEntry(entry.id, "number", v)}
                    onScan={(code) => updateSefazEntry(entry.id, "number", code)}
                    placeholder="Número da nota ou chave de 44 dígitos"
                    inputClassName="min-h-[48px] text-base font-mono tracking-wider"
                    maxLength={54}
                    inputMode="numeric"
                    showCameraButton
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {entry.number.replace(/\D/g, "").length === 44 
                      ? "Chave de acesso detectada (44 dígitos)" 
                      : `${entry.number.replace(/\D/g, "").length} dígitos informados`}
                  </p>
                </div>
                <div className="w-20">
                  <Input
                    placeholder="Série"
                    value={entry.series}
                    onChange={(e) => updateSefazEntry(entry.id, "series", e.target.value)}
                    className="min-h-[48px]"
                  />
                </div>
                {sefazEntries.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => removeSefazEntry(entry.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 min-h-[44px]"
                onClick={addSefazEntry}
                disabled={sefazEntries.length >= 20}
              >
                <Plus className="h-4 w-4" /> Adicionar outra NF
              </Button>
              <Button
                className="flex-1 min-h-[44px]"
                onClick={handleSefazSearch}
                disabled={loading || sefazEntries.every((e) => e.number.replace(/\D/g, "").length < 1)}
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {loading ? `Buscando ${batchSearchProgress.current} de ${batchSearchProgress.total}...` : "Buscar Nota"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {nfMode === "xml" && (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="p-8">
            <div
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleBatchDrop}
            >
              <Upload className={`mb-3 h-10 w-10 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground/40"}`} />
              <p className="text-sm font-medium mb-1">Arraste um ou vários XMLs aqui</p>
              <p className="text-xs text-muted-foreground mb-4">Suporta seleção múltipla de arquivos</p>
              <input
                ref={batchFileRef}
                type="file"
                accept=".xml"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) handleBatchXmlUpload(e.target.files); if (batchFileRef.current) batchFileRef.current.value = ""; }}
              />
              <Button variant="outline" onClick={() => batchFileRef.current?.click()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Selecionar XML(s)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Processando nota(s) fiscal(is)...</p>
        </div>
      )}

      {batchNfes.length === 1 && !loading && (
        <Card className={batchNfes[0].nfeData.products.length > 0 ? "border-emerald-500/30" : "border-amber-500/30"}>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${batchNfes[0].nfeData.products.length > 0 ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
                {batchNfes[0].nfeData.products.length > 0
                  ? <CheckCircle className="h-5 w-5 text-emerald-500" />
                  : <AlertTriangle className="h-5 w-5 text-amber-500" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">NF-e nº {batchNfes[0].nfeData.number}</p>
                <p className="text-xs text-muted-foreground">{batchNfes[0].nfeData.issuerName}</p>
              </div>
              <Badge className={batchNfes[0].nfeData.products.length > 0
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-400 border-amber-500/30"}>
                {batchNfes[0].nfeData.products.length} itens — {formatCurrency(batchNfes[0].nfeData.totalValue)}
              </Badge>
            </div>
            {batchNfes[0].nfeData.products.length === 0 && (
              <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 space-y-1">
                <p className="font-medium">⚠️ Nota sem itens/produtos</p>
                <p className="text-xs text-amber-400/80">
                  {batchNfes[0].partialReason || "A busca pela chave de acesso retorna apenas os dados do cabeçalho da nota (número, série, CNPJ, UF). Para importar os produtos e realizar a conferência, utilize o modo XML com o arquivo da nota fiscal."}
                </p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => { setBatchNfes([]); setNfeData(null); setMatches([]); }}>
                Trocar nota
              </Button>
              {batchNfes[0].nfeData.products.length === 0 ? (
                <Button variant="outline" className="gap-2" onClick={() => { setBatchNfes([]); setNfeData(null); setMatches([]); setNfMode("xml"); }}>
                  <Upload className="h-4 w-4" /> Importar XML
                </Button>
              ) : (
                <Button className="gap-2" onClick={() => goToStep(2)}>
                  Próximo <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
