import { Trash2, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { type BatchNfe } from "../types";

interface BatchNfeListProps {
  batchNfes: BatchNfe[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onRemove: (id: string) => void;
  goToStep: (s: any) => void;
  formatCurrency: (v: number) => string;
  selectedBatchNfes: BatchNfe[];
  batchTotalItems: number;
  batchTotalValue: number;
}

export const BatchNfeList = ({
  batchNfes, onToggle, onToggleAll, onRemove, goToStep, formatCurrency, selectedBatchNfes, batchTotalItems, batchTotalValue
}: BatchNfeListProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Files className="h-5 w-5" />
            Notas carregadas ({batchNfes.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onToggleAll}>
              {batchNfes.every((n) => n.selected) ? "Desmarcar todas" : "Selecionar todas"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[40px]" />
              <TableHead>Nº NF</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-center">Itens</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {batchNfes.map((nf) => (
              <TableRow key={nf.id} className={nf.nfeData.products.length === 0 ? "opacity-70" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={nf.selected}
                    disabled={nf.nfeData.products.length === 0}
                    onCheckedChange={() => onToggle(nf.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{nf.nfeData.number}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{nf.nfeData.issuerName}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span>{nf.nfeData.products.length}</span>
                    {nf.partialData && <Badge variant="outline" className="text-[10px]">Cabeçalho</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(nf.nfeData.totalValue)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(nf.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/10">
          <div className="flex gap-6 text-sm">
            <span className="text-muted-foreground">
              <strong className="text-foreground">{selectedBatchNfes.length}</strong> nota(s) selecionada(s)
            </span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">{batchTotalItems}</strong> itens
            </span>
            <span className="text-muted-foreground">
              Total: <strong className="text-primary">{formatCurrency(batchTotalValue)}</strong>
            </span>
          </div>
          <Button onClick={() => goToStep(2)} disabled={selectedBatchNfes.length === 0} className="gap-2">
            Avançar com {selectedBatchNfes.length} nota(s) <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
