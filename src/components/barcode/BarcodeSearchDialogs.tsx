
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package, Tag, Link as LinkIcon, X } from "lucide-react";

interface BarcodeSearchDialogsProps {
  notFoundOpen: boolean;
  setNotFoundOpen: (open: boolean) => void;
  boxDetectedOpen: boolean;
  setBoxDetectedOpen: (open: boolean) => void;
  codigo: string;
  produto?: any;
  boxQty?: number;
  onConfirmBox: (qty: number) => void;
  onRegisterGtin: () => void;
  onRegisterProduct: () => void;
  onLinkProduct: () => void;
}

export const BarcodeSearchDialogs: React.FC<BarcodeSearchDialogsProps> = ({
  notFoundOpen,
  setNotFoundOpen,
  boxDetectedOpen,
  setBoxDetectedOpen,
  codigo,
  produto,
  boxQty,
  onConfirmBox,
  onRegisterGtin,
  onRegisterProduct,
  onLinkProduct,
}) => {
  return (
    <>
      {/* Modal: Código não reconhecido */}
      <Dialog open={notFoundOpen} onOpenChange={setNotFoundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" />
              Código não reconhecido: {codigo}
            </DialogTitle>
            <DialogDescription>
              O que deseja fazer com este código?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                setNotFoundOpen(false);
                onRegisterGtin();
              }}
            >
              <Package className="h-4 w-4" />
              É uma CAIXA — cadastrar GTIN
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                setNotFoundOpen(false);
                onRegisterProduct();
              }}
            >
              <Tag className="h-4 w-4" />
              É um PRODUTO — cadastrar novo
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                setNotFoundOpen(false);
                onLinkProduct();
              }}
            >
              <LinkIcon className="h-4 w-4" />
              Vincular a produto existente
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNotFoundOpen(false)}>
              Ignorar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: CAIXA detectada */}
      <Dialog open={boxDetectedOpen} onOpenChange={setBoxDetectedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Package className="h-5 w-5" />
              📦 CAIXA detectada!
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="font-medium">Produto: {produto?.name}</p>
            <p className="text-sm text-muted-foreground">
              Qtd por caixa: {boxQty} unidades
            </p>
            <p className="mt-4 font-semibold">
              Bipar como {boxQty} unidades?
            </p>
          </div>
          <DialogFooter className="flex flex-row gap-2 sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setBoxDetectedOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (boxQty) onConfirmBox(boxQty);
                setBoxDetectedOpen(false);
              }}
            >
              ✅ Sim, +{boxQty} unidades
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
