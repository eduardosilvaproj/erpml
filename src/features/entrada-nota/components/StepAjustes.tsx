import { useState } from "react";
import { Plus, Trash2, ArrowLeft, ArrowRight, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
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
  onRemoveKitGroup: (kitId: string) => void;
  entryNotes: string;
  setEntryNotes: (v: string) => void;
  setCurrentStep: (s: any) => void;
  goToStep: (s: any) => void;
  formatCurrency: (v: number) => string;
  onRemoveKitGroup: (kitId: string) => void;
}

export const StepAjustes = ({
  itemsToShow, adjustedItems, updateAdjustedQty, updateAdjustedCost, removeAdjustedItem,
  onOpenNewProduct, entryNotes, setEntryNotes, setCurrentStep, goToStep, formatCurrency, hasMatchesOrBatch,
  kitGroups, onCreateKit, onRemoveKitGroup
}: StepAjustesProps) => {
  const rows = adjustedItems.length > 0 ? adjustedItems : itemsToShow;
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [kitDialog, setKitDialog] = useState(false);
  const [kitName, setKitName] = useState("");
  const [kitSku, setKitSku] = useState("");
  const [kitPrice, setKitPrice] = useState("");
  const [kitQty, setKitQty] = useState(1);

  const inKitIdx = new Set<number>(kitGroups.flatMap((k) => k.itemIndices));

  const toggleSel = (idx: number) => {
    if (inKitIdx.has(idx)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const openKitDialog = () => {
    const indices = Array.from(selected);
    const first = rows[indices[0]];
    const suggestedName = `Kit ${indices.map((i) => rows[i]?.xmlProduct.description?.split(" ")[0]).filter(Boolean).join(" + ")}`.slice(0, 80);
    setKitName(suggestedName || `Kit ${Date.now()}`);
    setKitSku(`KIT-${Date.now().toString().slice(-6)}`);
    setKitPrice(String(indices.reduce((s, i) => s + (rows[i]?.xmlProduct.unitValue || 0), 0).toFixed(2)));
    setKitQty(Math.floor(first?.xmlProduct.quantity || 1));
    setKitDialog(true);
  };

  const confirmKit = () => {
    const indices = Array.from(selected);
    const cost = indices.reduce((s, i) => s + (rows[i]?.xmlProduct.unitValue || 0), 0);
    onCreateKit({
      kitId: `kit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: kitName.trim() || `Kit ${Date.now()}`,
      sku: kitSku.trim() || `KIT-${Date.now()}`,
      itemIndices: indices,
      quantity: kitQty,
      cost,
      price: parseFloat(kitPrice) || 0,
    });
    setSelected(new Set());
    setKitDialog(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">{rows.length} produto(s){kitGroups.length > 0 && ` • ${kitGroups.length} kit(s)`}</p>
        <div className="flex gap-2">
          {selected.size >= 2 && (
            <Button size="sm" className="gap-1" onClick={openKitDialog}>
              <Package className="h-3.5 w-3.5" /> Criar Kit ({selected.size})
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1" onClick={onOpenNewProduct}>
            <Plus className="h-3.5 w-3.5" /> Cadastrar produto
          </Button>
        </div>
      </div>

      {kitGroups.length > 0 && (
        <div className="space-y-2">
          {kitGroups.map((kg) => (
            <div key={kg.kitId} className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 min-w-0">
                <Package className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">🎁 {kg.name}</p>
                  <p className="text-xs text-muted-foreground">{kg.itemIndices.length} componentes • {kg.quantity} kit(s) • Custo {formatCurrency(kg.cost)}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemoveKitGroup(kg.kitId)}>
                <X className="h-4 w-4" />
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
            {rows.map((item, i) => {
              const isInKit = inKitIdx.has(i);
              return (
                <TableRow key={i} className={isInKit ? "opacity-50" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(i) || isInKit}
                      disabled={isInKit}
                      onCheckedChange={() => toggleSel(i)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.xmlProduct.description}</p>
                        <p className="text-xs text-muted-foreground">{item.xmlProduct.ean || item.xmlProduct.code}</p>
                      </div>
                      {isInKit && <Badge variant="secondary" className="text-[10px]">Em kit</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      value={item.xmlProduct.quantity}
                      onChange={(e) => updateAdjustedQty(i, parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 text-center mx-auto"
                      min={0}
                      disabled={isInKit}
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
                      disabled={isInKit}
                    />
                  </TableCell>
                  <TableCell className="text-center font-medium text-sm">
                    {formatCurrency(item.xmlProduct.quantity * item.xmlProduct.unitValue)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAdjustedItem(i)} disabled={isInKit}>
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

      <Dialog open={kitDialog} onOpenChange={setKitDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Kit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome do kit *</label>
              <Input value={kitName} onChange={(e) => setKitName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">SKU *</label>
                <Input value={kitSku} onChange={(e) => setKitSku(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço de venda</label>
                <Input type="number" step="0.01" value={kitPrice} onChange={(e) => setKitPrice(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Quantidade de kits</label>
              <Input type="number" min={1} value={kitQty} onChange={(e) => setKitQty(parseInt(e.target.value) || 1)} />
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">Componentes:</p>
              {Array.from(selected).map((i) => (
                <p key={i} className="text-xs">• {rows[i]?.xmlProduct.description} ({formatCurrency(rows[i]?.xmlProduct.unitValue || 0)})</p>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKitDialog(false)}>Cancelar</Button>
            <Button onClick={confirmKit}>Criar Kit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
