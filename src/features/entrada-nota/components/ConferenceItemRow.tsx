import React from "react";
import { Package, Minus, Plus } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ConferenceItem } from "../types";

interface ConferenceItemRowProps {
  item: ConferenceItem;
  index: number;
  flashIdx: number | null;
  isBatchModeTogether: boolean;
  onQtyChange: (newQty: number) => void;
  onBoxClick: () => void;
}

export const ConferenceItemRow = ({
  item, index, flashIdx, isBatchModeTogether, onQtyChange, onBoxClick
}: ConferenceItemRowProps) => {
  const pct = item.expectedQty > 0 ? Math.min(100, (item.scannedQty / item.expectedQty) * 100) : 0;
  
  return (
    <TableRow className={`transition-all duration-500 ${
      flashIdx === index ? "!bg-emerald-500/20" :
      item.status === "ok" ? "bg-emerald-500/5" :
      item.status === "excess" ? "bg-destructive/5" :
      item.status === "partial" ? "bg-amber-500/5" : ""
    }`}>
      {isBatchModeTogether && (
        <TableCell>
          <Badge variant="outline" className="text-[10px]">{item.nfNumber}</Badge>
        </TableCell>
      )}
      <TableCell className="text-center">
        <button
          onClick={onBoxClick}
          className={`text-lg transition-colors ${
            item.boxBadge
              ? "text-primary"
              : item.matchedProductGtinCx
              ? "text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.4)]"
              : "text-muted-foreground/40 hover:text-primary"
          }`}
          title={item.matchedProductGtinCx
            ? `GTIN CX cadastrado: ${item.matchedProductGtinCx} (${item.matchedProductBoxQty || '?'} un/cx)`
            : "Configurar entrada em caixa"
          }
        >
          📦
        </button>
      </TableCell>
      <TableCell>
        <div className="h-9 w-9 rounded-lg bg-muted/30 flex items-center justify-center">
          <Package className="h-4 w-4 text-muted-foreground/40" />
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm font-medium">{item.xmlProduct.description}</div>
        {item.boxBadge && (
          <Badge className="mt-1 bg-primary/15 text-primary border-primary/30 text-[10px]">{item.boxBadge}</Badge>
        )}
      </TableCell>
      <TableCell className="text-xs font-mono text-muted-foreground">{item.xmlProduct.ean || item.xmlProduct.code}</TableCell>
      <TableCell className="text-center font-medium">{item.expectedQty}</TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onQtyChange(Math.max(0, item.scannedQty - 1))}>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="font-bold w-8 text-center text-lg">{item.scannedQty}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onQtyChange(item.scannedQty + 1)}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                item.status === "ok" ? "bg-emerald-500" :
                item.status === "excess" ? "bg-destructive" :
                item.status === "partial" ? "bg-amber-500" : "bg-muted-foreground/30"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground w-8 text-right">{Math.round(pct)}%</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge className={
          item.status === "ok" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
          item.status === "excess" ? "bg-destructive/15 text-destructive" :
          item.status === "partial" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
          "bg-muted text-muted-foreground"
        }>
          {item.status === "ok" ? "OK" : item.status === "excess" ? "Divergente" : item.status === "partial" ? "Parcial" : "Pendente"}
        </Badge>
      </TableCell>
    </TableRow>
  );
};
