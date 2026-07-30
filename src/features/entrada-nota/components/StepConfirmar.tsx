import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { type BatchNfe } from "../types";
import { type MatchResult } from "@/lib/nfe-parser";

interface StepConfirmarProps {
  isBatchMode: boolean;
  selectedBatchNfes: BatchNfe[];
  batchSelectedForConfirm: Set<string>;
  setBatchSelectedForConfirm: React.Dispatch<React.SetStateAction<Set<string>>>;
  nfeData: any;
  itemsToShow: MatchResult[];
  totalValue: number;
  autoUpdateStock: boolean;
  setAutoUpdateStock: (v: boolean) => void;
  autoUpdateCost: boolean;
  setAutoUpdateCost: (v: boolean) => void;
  updateAdjustedName: (idx: number, name: string) => void;
  confirmarEntrada: () => void;
  saving: boolean;
  formatCurrency: (v: number) => string;
  setCurrentStep: (s: any) => void;
}

export const StepConfirmar = ({
  isBatchMode, selectedBatchNfes, batchSelectedForConfirm, setBatchSelectedForConfirm,
  nfeData, itemsToShow, totalValue, autoUpdateStock, setAutoUpdateStock,
  autoUpdateCost, setAutoUpdateCost, updateAdjustedName, confirmarEntrada, saving, formatCurrency, setCurrentStep
}: StepConfirmarProps) => {
  return (
    <div className="space-y-5">
      {isBatchMode ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo do Lote</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[50px]" />
                    <TableHead>Nº NF</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Conferência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedBatchNfes.map((nf) => (
                    <TableRow key={nf.id}>
                      <TableCell>
                        <Checkbox
                          checked={batchSelectedForConfirm.has(nf.id)}
                          onCheckedChange={(v) => {
                            setBatchSelectedForConfirm((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(nf.id); else next.delete(nf.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{nf.nfeData.number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{nf.nfeData.issuerName}</TableCell>
                      <TableCell className="text-center">{nf.nfeData.products.length}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(nf.nfeData.totalValue)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={
                          nf.conferenceStatus === "done"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-muted text-muted-foreground"
                        }>
                          {nf.conferenceStatus === "done" ? "Conferida" : "Pendente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-semibold">Total Geral do Lote</p>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(selectedBatchNfes.reduce((sum, n) => sum + n.nfeData.totalValue, 0))}
            </p>
          </div>
        </>
      ) : (
        <>
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Fornecedor</p>
                  <p className="font-medium mt-1">{nfeData?.issuerName || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Número NF</p>
                  <p className="font-medium mt-1">nº {nfeData?.number || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Data</p>
                  <p className="font-medium mt-1">{nfeData?.issueDate ? new Date(nfeData.issueDate).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="rounded-xl border border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-center">Custo Unit.</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsToShow.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">
                      <Input
                        value={item.xmlProduct.description}
                        onChange={(e) => updateAdjustedName(i, e.target.value)}
                        className="h-8 text-sm font-medium"
                      />
                      {item.matchedProductName && item.matchedProductName !== item.xmlProduct.description && (
                        <p className="text-xs text-amber-500 mt-0.5">Sistema: {item.matchedProductName}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{item.xmlProduct.quantity}</TableCell>
                    <TableCell className="text-center">{formatCurrency(item.xmlProduct.unitValue)}</TableCell>
                    <TableCell className="text-center font-medium">{formatCurrency(item.xmlProduct.totalValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-semibold">Total Geral da Entrada</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(totalValue)}</p>
          </div>
        </>
      )}

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox checked={autoUpdateStock} onCheckedChange={(v) => setAutoUpdateStock(!!v)} />
          <span className="text-sm">Atualizar estoque {isBatchMode ? "de todas as notas" : "automaticamente"}</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox checked={autoUpdateCost} onCheckedChange={(v) => setAutoUpdateCost(!!v)} />
          <span className="text-sm">Atualizar preço de custo</span>
        </label>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(4)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div className="flex gap-3">
          {isBatchMode && (
            <Button
              variant="outline"
              onClick={() => {
                setBatchSelectedForConfirm(new Set(selectedBatchNfes.map((n) => n.id)));
              }}
            >
              Selecionar todas
            </Button>
          )}
          <Button
            className="min-h-[48px] px-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={confirmarEntrada}
            disabled={saving || (isBatchMode && batchSelectedForConfirm.size === 0)}
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
            {isBatchMode
              ? batchSelectedForConfirm.size === selectedBatchNfes.length
                ? "✓ Confirmar todas as entradas"
                : `✓ Confirmar selecionadas (${batchSelectedForConfirm.size})`
              : "✓ Confirmar entrada"}
          </Button>
        </div>
      </div>
    </div>
  );
};
