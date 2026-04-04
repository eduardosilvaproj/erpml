import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { generateEAN13, isValidEAN13 } from "@/lib/ean13";
import { Barcode, Copy, Download, Trash2, RefreshCw, CheckCircle2 } from "lucide-react";

export default function GeradorEAN13() {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(10);
  const [codes, setCodes] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Códigos Gerados</CardTitle>
                <CardDescription>
                  <Badge variant="secondary" className="mt-1">{codes.length} códigos</Badge>
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyAll} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  Copiar Todos
                </Button>
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Exportar CSV
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCodes([])} className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar
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
