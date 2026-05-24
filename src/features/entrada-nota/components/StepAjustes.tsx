import { Plus, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { type MatchResult } from "@/lib/nfe-parser";

interface StepAjustesProps {
  itemsToShow: MatchResult[];
  adjustedItems: MatchResult[];
  updateAdjustedQty: (idx: number, qty: number) => void;
  updateAdjustedCost: (idx: number, cost: number) => void;
  removeAdjustedItem: (idx: number) => void;
  onOpenNewProduct: () => void;
  entryNotes: string;
  setEntryNotes: (v: string) => void;
  setCurrentStep: (s: any) => void;
  goToStep: (s: any) => void;
  formatCurrency: (v: number) => string;
  hasMatchesOrBatch: boolean;
}

export const StepAjustes = ({
  itemsToShow, adjustedItems, updateAdjustedQty, updateAdjustedCost, removeAdjustedItem,
  onOpenNewProduct, entryNotes, setEntryNotes, setCurrentStep, goToStep, formatCurrency, hasMatchesOrBatch
}: StepAjustesProps) => {
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{itemsToShow.length} produto(s)</p>
        <Button variant="outline" size="sm" className="gap-1" onClick={onOpenNewProduct}>
          <Plus className="h-3.5 w-3.5" /> Cadastrar produto
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Produto</TableHead>
              <TableHead className="text-center w-[100px]">Quantidade</TableHead>
              <TableHead className="text-center w-[130px]">Preço de Custo</TableHead>
              <TableHead className="text-center w-[130px]">Total</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(adjustedItems.length > 0 ? adjustedItems : itemsToShow).map((item, i) => (
              <TableRow key={i}>
                <TableCell>
                  <p className="text-sm font-medium">{item.xmlProduct.description}</p>
                  <p className="text-xs text-muted-foreground">{item.xmlProduct.ean || item.xmlProduct.code}</p>
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    value={item.xmlProduct.quantity}
                    onChange={(e) => updateAdjustedQty(i, parseFloat(e.target.value) || 0)}
                    className="w-20 h-8 text-center mx-auto"
                    min={0}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    step="0.01"
                    value={item.xmlProduct.unitValue}
                    onChange={(e) => updateAdjustedCost(i, parseFloat(e.target.value) || 0)}
                    className="w-24 h-8 text-center mx-auto"
                    min={0}
                  />
                </TableCell>
                <TableCell className="text-center font-medium text-sm">
                  {formatCurrency(item.xmlProduct.quantity * item.xmlProduct.unitValue)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAdjustedItem(i)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observação geral da entrada</label>
        <Textarea
          value={entryNotes}
          onChange={(e) => setEntryNotes(e.target.value)}
          placeholder="Observações opcionais sobre esta entrada..."
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setCurrentStep(hasMatchesOrBatch ? 3 : 1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <Button onClick={() => goToStep(5)}>
          Próximo <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
