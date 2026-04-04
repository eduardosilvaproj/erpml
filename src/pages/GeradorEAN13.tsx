import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { generateEAN13, isValidEAN13 } from "@/lib/ean13";
import { Barcode, Copy, Download, Trash2, RefreshCw, CheckCircle2, Printer } from "lucide-react";
import JsBarcode from "jsbarcode";

const LABEL_SIZES = {
  "30x20": { name: "30×20 mm (Pequena)", width: 113, height: 76, cols: 5, rows: 13 },
  "40x25": { name: "40×25 mm (Média)", width: 151, height: 94, cols: 4, rows: 10 },
  "50x30": { name: "50×30 mm (Grande)", width: 189, height: 113, cols: 3, rows: 8 },
  "100x40": { name: "100×40 mm (Extra)", width: 378, height: 151, cols: 2, rows: 6 },
} as const;

type LabelSize = keyof typeof LABEL_SIZES;

function BarcodeLabel({ code, width, height }: { code: string; width: number; height: number }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, code, {
          format: "EAN13",
          width: Math.max(1, width < 160 ? 1 : 1.5),
          height: Math.max(20, height * 0.45),
          fontSize: Math.max(8, Math.min(12, width * 0.07)),
          margin: 2,
          displayValue: true,
          textMargin: 1,
        });
      } catch {
        // fallback for invalid codes
      }
    }
  }, [code, width, height]);

  return (
    <div
      className="flex items-center justify-center border border-gray-300 bg-white overflow-hidden"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <svg ref={svgRef} />
    </div>
  );
}

export default function GeradorEAN13() {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(10);
  const [codes, setCodes] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [labelSize, setLabelSize] = useState<LabelSize>("40x25");
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(() => {
    const qty = Math.min(Math.max(1, quantity), 1000);
    const generated: string[] = [];
    const seen = new Set<string>();
    while (generated.length < qty) {
      const code = generateEAN13();
      if (!seen.has(code)) {
        seen.add(code);
        generated.push(code);
      }
    }
    setCodes(generated);
    toast({ title: `${generated.length} códigos EAN-13 gerados!` });
  }, [quantity, toast]);

  const copyToClipboard = async (code: string, index: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(codes.join("\n"));
    toast({ title: "Todos os códigos copiados!" });
  };

  const exportCSV = () => {
    const csv = "EAN-13\n" + codes.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ean13_${codes.length}_codigos.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado!" });
  };

  const removeCode = (index: number) => {
    setCodes((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const size = LABEL_SIZES[labelSize];
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ title: "Erro", description: "Permita pop-ups para imprimir.", variant: "destructive" });
      return;
    }

    const labelsHTML = printRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiquetas EAN-13</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; }
          @page { margin: 5mm; }
          .labels-grid {
            display: grid;
            grid-template-columns: repeat(${size.cols}, ${size.width}px);
            gap: 2px;
            justify-content: center;
          }
          .label-item {
            width: ${size.width}px;
            height: ${size.height}px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            page-break-inside: avoid;
          }
          .label-item svg { max-width: 100%; max-height: 100%; }
          @media print {
            .labels-grid { gap: 0; }
          }
        </style>
      </head>
      <body>
        <div class="labels-grid">${labelsHTML}</div>
        <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const size = LABEL_SIZES[labelSize];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Barcode className="h-5 w-5 text-primary" />
          </div>
          Gerador EAN-13 em Massa
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gere códigos de barras EAN-13 válidos com dígito verificador calculado automaticamente
        </p>
      </div>

      {/* Generator Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Configuração</CardTitle>
          <CardDescription>Informe a quantidade e gere os códigos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Quantidade</label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground mt-1">Máximo: 1.000 códigos por vez</p>
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerate} className="gap-2 w-full sm:w-auto">
                <RefreshCw className="h-4 w-4" />
                Gerar Códigos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {codes.length > 0 && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Códigos Gerados</CardTitle>
                  <CardDescription>
                    <Badge variant="secondary" className="mt-1">{codes.length} códigos</Badge>
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5">
                    <Copy className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Copiar Todos</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Exportar CSV</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)} className="gap-1.5">
                    <Printer className="h-3.5 w-3.5" />
                    {showPreview ? "Ocultar Etiquetas" : "Imprimir Etiquetas"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setCodes([]); setShowPreview(false); }} className="gap-1.5 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Limpar</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Código EAN-13</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                      <TableHead className="w-20 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {codes.map((code, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                        <TableCell>
                          <code className="font-mono text-sm tracking-widest">{code}</code>
                        </TableCell>
                        <TableCell className="text-center">
                          {isValidEAN13(code) ? (
                            <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Válido
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">Inválido</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyToClipboard(code, i)}
                              title="Copiar"
                            >
                              {copiedIndex === i ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeCode(i)}
                              title="Remover"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Print Labels Section */}
          {showPreview && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Printer className="h-4 w-4" />
                      Prévia de Etiquetas
                    </CardTitle>
                    <CardDescription>Visualize e imprima as etiquetas com código de barras</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSize)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LABEL_SIZES).map(([key, val]) => (
                          <SelectItem key={key} value={key}>{val.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handlePrint} className="gap-2">
                      <Printer className="h-4 w-4" />
                      Imprimir
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  {size.cols} colunas × {size.rows} linhas por página • {size.cols * size.rows} etiquetas/página • {Math.ceil(codes.length / (size.cols * size.rows))} página(s)
                </p>
                <div className="overflow-x-auto rounded-lg border bg-white p-4">
                  <div
                    ref={printRef}
                    className="mx-auto"
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${size.cols}, ${size.width}px)`,
                      gap: "2px",
                      justifyContent: "center",
                    }}
                  >
                    {codes.map((code, i) => (
                      <div key={i} className="label-item">
                        <BarcodeLabel code={code} width={size.width} height={size.height} />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Info Card */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Barcode className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Sobre o EAN-13:</strong> Padrão internacional de código de barras com 13 dígitos usado em produtos comerciais.</p>
              <p>• Prefixo <strong>789</strong> (Brasil - GS1) • Dígito verificador calculado automaticamente • Códigos únicos por geração</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
