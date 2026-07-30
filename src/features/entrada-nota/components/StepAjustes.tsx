import { useState } from "react";
import { Plus, Trash2, ArrowLeft, ArrowRight, Package, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { type MatchResult } from "@/lib/nfe-parser";
import { type KitGroup } from "../types";

interface StepAjustesProps {
  itemsToShow: MatchResult[];
  adjustedItems: MatchResult[];
  kitGroups: KitGroup[];
  updateAdjustedQty: (idx: number, qty: number) => void;
  updateAdjustedCost: (idx: number, cost: number) => void;
  updateAdjustedName: (idx: number, name: string) => void;
  removeAdjustedItem: (idx: number) => void;
  onOpenNewProduct: () => void;
  onCreateKit: (name: string, sku: string, price: number, itemIndices: number[], quantity: number) => void;
  onRemoveKitGroup: (kitId: string) => void;
  entryNotes: string;
  setEntryNotes: (v: string) => void;
  setCurrentStep: (s: any) => void;
  goToStep: (s: any) => void;
  formatCurrency: (v: number) => string;
  hasMatchesOrBatch: boolean;
}

export const StepAjustes = ({
  itemsToShow, adjustedItems, kitGroups, updateAdjustedQty, updateAdjustedCost, updateAdjustedName, removeAdjustedItem,
  onOpenNewProduct, onCreateKit, onRemoveKitGroup, entryNotes, setEntryNotes, setCurrentStep, goToStep, formatCurrency, hasMatchesOrBatch
}: StepAjustesProps) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [kitDialogOpen, setKitDialogOpen] = useState(false);
  const [kitName, setKitName] = useState("");
  const [kitSku, setKitSku] = useState("");
  const [kitPrice, setKitPrice] = useState(0);
  const [kitQuantity, setKitQuantity] = useState(1);

  const items = adjustedItems.length > 0 ? adjustedItems : itemsToShow;
  const kitItemIndices = new Set(kitGroups.flatMap(g => g.itemIndices));

  const toggleSelect = (idx: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const openKitDialog = () => {
    const selected = Array.from(selectedIndices).map(i => items[i]);
    if (selected.length < 2) return;
    const minQty = Math.min(...selected.map(s => Math.floor(s.xmlProduct.quantity)));
    const totalCost = selected.reduce((sum, s) => sum + s.xmlProduct.unitValue * s.xmlProduct.quantity, 0);
    const names = selected.map(s => s.xmlProduct.description);
    const suggestedName = names.length <= 3 ? names.join(" + ") : `${names[0]} + ${names[1]} + ...`;
    setKitName(suggestedName);
    setKitSku(`KIT-ENT-${Date.now().toString(36).toUpperCase()}`);
    setKitPrice(Math.round(totalCost * 1.3 * 100) / 100);
    setKitQuantity(minQty);
    setKitDialogOpen(true);
  };

  const confirmKit = () => {
    if (!kitName.trim() || !kitSku.trim()) return;
    onCreateKit(kitName.trim(), kitSku.trim(), kitPrice, Array.from(selectedIndices), kitQuantity);
    setSelectedIndices(new Set());
    setKitDialogOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} produto(s)</p>
        <div className="flex gap-2">
          {selectedIndices.size >= 2 && (
            <Button size="sm" className="gap-1" onClick={openKitDialog}>
              <Package className="h-3.5 w-3.5" /> Criar Kit ({selectedIndices.size})
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1" onClick={onOpenNewProduct}>
            <Plus className="h-3.5 w-3.5" /> Cadastrar produto
          </Button>
        </div>
      </div>

      {kitGroups.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Kits criados nesta entrada:</p>
          {kitGroups.map(kg => (
            <div key={kg.kitId} className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-medium">{kg.name}</span>
                <Badge variant="secondary">{kg.quantity}x</Badge>
                <span className="text-muted-foreground text-xs">SKU: {kg.sku}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveKitGroup(kg.kitId)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[40px]" />
              <TableHead>Produto</TableHead>
              <TableHead className="text-center w-[100px]">Quantidade</TableHead>
              <TableHead className="text-center w-[130px]">Preço de Custo</TableHead>
              <TableHead className="text-center w-[130px]">Total</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, i) => {
              const inKit = kitItemIndices.has(i);
              return (
                <TableRow key={i} className={inKit ? "opacity-50" : ""}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 rounded border ${selectedIndices.has(i) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                      onClick={() => toggleSelect(i)}
                      disabled={inKit}
                    >
                      {selectedIndices.has(i) && <Check className="h-3.5 w-3.5" />}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Input
                        value={item.xmlProduct.description}
                        onChange={(e) => updateAdjustedName(i, e.target.value)}
                        className="h-8 text-sm font-medium"
                        disabled={inKit}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-xs text-muted-foreground">{item.xmlProduct.ean || item.xmlProduct.code}</span>
                        {item.matchedProductName && item.matchedProductName !== item.xmlProduct.description && (
                          <span className="text-xs text-amber-500">
                            Sistema: {item.matchedProductName}
                          </span>
                        )}
                      </div>
                      {inKit && <Badge variant="outline" className="mt-1 text-xs w-fit">Em kit</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={item.xmlProduct.quantity}
                      onChange={(e) => updateAdjustedQty(i, parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 text-center mx-auto"
                      min={0}
                      disabled={inKit}
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
                      disabled={inKit}
                    />
                  </TableCell>
                  <TableCell className="text-center font-medium text-sm">
                    {formatCurrency(item.xmlProduct.quantity * item.xmlProduct.unitValue)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAdjustedItem(i)} disabled={inKit}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
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

      <Dialog open={kitDialogOpen} onOpenChange={setKitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Criar Kit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do Kit *</label>
              <Input value={kitName} onChange={e => setKitName(e.target.value)} placeholder="Ex: Kit Perfume Premium" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU *</label>
              <Input value={kitSku} onChange={e => setKitSku(e.target.value)} placeholder="KIT-XXX" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Preço de Venda</label>
              <Input type="number" step="0.01" value={kitPrice} onChange={e => setKitPrice(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Quantidade de Kits</label>
              <Input type="number" value={kitQuantity} onChange={e => setKitQuantity(parseInt(e.target.value) || 1)} min={1} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Componentes ({selectedIndices.size}):</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {Array.from(selectedIndices).map(i => {
                  const item = items[i];
                  return (
                    <div key={i} className="flex justify-between text-sm bg-muted/30 rounded px-2 py-1">
                      <span className="truncate">{item.xmlProduct.description}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{Math.floor(item.xmlProduct.quantity)}un</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKitDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmKit}>Criar Kit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
