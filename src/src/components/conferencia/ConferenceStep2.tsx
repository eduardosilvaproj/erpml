import React, { useState, useRef } from "react";
import { 
  ScanBarcode, Package, Minus, Search, 
  ArrowRight, Download, FileDown, CheckCircle, XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { ScannedProduct } from "./types";

interface ConferenceStep2Props {
  scannedProducts: ScannedProduct[];
  onAddProduct: (code: string) => void;
  onEditQty: (productId: string, newQty: number) => void;
  onFinish: () => void;
  onExportCSV: () => void;
  onExportPDF?: () => void; // Optional but good to have
  lastScan?: { success: boolean; name: string; code: string } | null;
  loading?: boolean;
}

export const ConferenceStep2: React.FC<ConferenceStep2Props> = ({
  scannedProducts,
  onAddProduct,
  onEditQty,
  onFinish,
  onExportCSV,
  onExportPDF,
  lastScan,
  loading
}) => {
  const [scanBuffer, setScanBuffer] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const scanInputRef = useRef<any>(null);

  const totalItems = scannedProducts.reduce((sum, p) => sum + p.scannedQty, 0);
  const uniqueProducts = scannedProducts.length;

  const filteredProducts = scannedProducts
    .filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.barcode?.includes(searchTerm)
    )
    .sort((a, b) => {
      const dateA = a.lastBipAt ? new Date(a.lastBipAt).getTime() : 0;
      const dateB = b.lastBipAt ? new Date(b.lastBipAt).getTime() : 0;
      return dateB - dateA;
    });

  const handleStartEdit = (p: ScannedProduct) => {
    setEditingId(p.productId);
    setEditValue(String(p.scannedQty));
  };

  const handleCommitEdit = () => {
    if (editingId) {
      const val = parseInt(editValue);
      if (!isNaN(val) && val >= 0) {
        onEditQty(editingId, val);
      }
      setEditingId(null);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {/* Coluna de Bipagem e Lista */}
      <div className="md:col-span-3 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <BarcodeScannerInput
                  ref={scanInputRef}
                  value={scanBuffer}
                  onChange={setScanBuffer}
                  onScan={(code) => {
                    onAddProduct(code);
                    setScanBuffer("");
                  }}
                  placeholder="Bipe o código do produto..."
                  inputClassName="text-lg h-14 font-mono"
                  icon={<ScanBarcode className="h-5 w-5" />}
                  autoFocus
                  scanMode
                />
              </div>
              <Button 
                className="h-14 px-6" 
                onClick={() => {
                  if (scanBuffer.trim()) {
                    onAddProduct(scanBuffer);
                    setScanBuffer("");
                  }
                }}
                disabled={!scanBuffer.trim()}
              >
                Bipar
              </Button>
            </div>

            {lastScan && (
              <div className={`rounded-lg p-3 flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-1 ${
                lastScan.success
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}>
                {lastScan.success ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                <span className="font-medium truncate">{lastScan.name}</span>
                <span className="text-muted-foreground ml-auto font-mono text-xs">{lastScan.code}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">Produtos bipados ({uniqueProducts})</CardTitle>
              <div className="relative w-40 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filtrar bipagens..."
                  className="h-8 pl-8 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[50vh] overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground text-center">
                  <ScanBarcode className="h-12 w-12 opacity-20 mb-3" />
                  <p className="text-sm font-medium">Nenhum produto encontrado</p>
                  <p className="text-xs">Bipe um código para começar ou mude o filtro</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredProducts.map((p) => (
                    <div key={p.productId} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-foreground">{p.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{p.sku}</p>
                        {p.boxInfo && (
                          <Badge variant="secondary" className="mt-1 text-[10px] h-5 bg-blue-500/10 text-blue-500 border-blue-500/20">
                            📦 {p.boxInfo.boxes}cx × {p.boxInfo.unitsPerBox}un
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => onEditQty(p.productId, p.scannedQty - 1)}
                          disabled={p.scannedQty <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        
                        {editingId === p.productId ? (
                          <Input
                            autoFocus
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCommitEdit}
                            onKeyDown={(e) => e.key === "Enter" && handleCommitEdit()}
                            className="h-8 w-16 text-center font-bold"
                          />
                        ) : (
                          <div 
                            className="w-12 text-center font-bold text-lg cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleStartEdit(p)}
                          >
                            {p.scannedQty}
                          </div>
                        )}

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => onEditQty(p.productId, p.scannedQty + 1)}
                        >
                          <span className="text-lg">+</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coluna de Resumo e Ações */}
      <div className="md:col-span-2 space-y-4">
        <Card className="bg-muted/20 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">Resumo da Conferência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Produtos Únicos</p>
                <p className="text-3xl font-black text-foreground">{uniqueProducts}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total de Itens</p>
                <p className="text-3xl font-black text-primary">{totalItems}</p>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                className="w-full h-12 text-base font-bold gap-2" 
                onClick={onFinish}
                disabled={uniqueProducts === 0 || loading}
              >
                Finalizar Conferência
                <ArrowRight className="h-5 w-5" />
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-2 text-xs" onClick={onExportCSV}>
                  <Download className="h-4 w-4" /> Exportar CSV
                </Button>
                {onExportPDF && (
                  <Button variant="outline" className="gap-2 text-xs" onClick={onExportPDF}>
                    <FileDown className="h-4 w-4" /> Exportar PDF
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-4 space-y-2">
          <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">Dica de Produtividade</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Mantenha o cursor no campo de leitura. Para alterar quantidades rapidamente, você pode clicar no número e digitar o valor desejado.
          </p>
        </div>
      </div>
    </div>
  );
};
