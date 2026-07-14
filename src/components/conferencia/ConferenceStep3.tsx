import React from "react";
import { 
  CheckCircle, AlertTriangle, XCircle, Download, FileDown, 
  RotateCcw, Check, Loader2, ClipboardList
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "./StatusBadge";
import { ScannedProduct, ConferenceResults } from "./types";

interface ConferenceStep3Props {
  results: ConferenceResults;
  conferenceName: string;
  mode: "nf" | "inventario" | null;
  conferenceType: "full" | "partial";
  sectionName?: string;
  adjusting: boolean;
  onAdjustStock: () => Promise<void>;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onReset: () => void;
  onBackToScan: () => void;
}

export const ConferenceStep3: React.FC<ConferenceStep3Props> = ({
  results,
  conferenceName,
  mode,
  conferenceType,
  sectionName,
  adjusting,
  onAdjustStock,
  onExportCSV,
  onExportPDF,
  onReset,
  onBackToScan
}) => {
  return (
    <div className="space-y-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              {conferenceName || "Resultado da Conferência"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide">
                {mode === "inventario" ? (conferenceType === "partial" ? "🟡 Inventário Parcial" : "🔵 Inventário Geral") : "📄 Nota Fiscal"}
              </Badge>
              {conferenceType === "partial" && sectionName && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] py-0 h-5">
                  📍 Seção: {sectionName}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground w-full sm:w-auto">
            Finalizada em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">OK</p>
              <p className="text-xl font-bold">{results.ok.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Divergente</p>
              <p className="text-xl font-bold">{results.divergent.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-lg bg-destructive/10 p-2">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Não bipado</p>
              <p className="text-xl font-bold">{results.notFound.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="divergent" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="divergent" className="gap-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Divergentes
          </TabsTrigger>
          <TabsTrigger value="ok" className="gap-2">
            <CheckCircle className="h-3.5 w-3.5" /> OK
          </TabsTrigger>
          <TabsTrigger value="notFound" className="gap-2">
            <XCircle className="h-3.5 w-3.5" /> Não Bipados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="divergent">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <StatusBadge status="Divergente" /> — {results.divergent.length} itens com diferença
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Sistema</TableHead>
                      <TableHead className="text-center">Contado</TableHead>
                      <TableHead className="text-center">Dif.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.divergent.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhuma divergência encontrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      results.divergent.map((sp) => {
                        const diff = sp.scannedQty - sp.systemQty;
                        return (
                          <TableRow key={sp.productId} className="hover:bg-amber-500/5">
                            <TableCell className="font-medium max-w-[200px] truncate">{sp.name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{sp.sku}</TableCell>
                            <TableCell className="text-center">{sp.systemQty}</TableCell>
                            <TableCell className="text-center font-bold">{sp.scannedQty}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={diff > 0 ? "secondary" : "destructive"} className="font-mono">
                                {diff > 0 ? `+${diff}` : diff}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ok">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <StatusBadge status="OK" /> — {results.ok.length} itens conferidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.ok.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          Nenhum item com quantidade correta ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      results.ok.map((sp) => (
                        <TableRow key={sp.productId} className="hover:bg-emerald-500/5">
                          <TableCell className="font-medium max-w-[200px] truncate">{sp.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{sp.sku}</TableCell>
                          <TableCell className="text-center font-bold">{sp.scannedQty}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notFound">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <StatusBadge status="Não bipado" /> — {results.notFound.length} itens ausentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-center">Sistema</TableHead>
                      <TableHead className="text-center">Dif.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.notFound.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Todos os itens do sistema foram bipados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      results.notFound.map((p) => (
                        <TableRow key={p.productId} className="hover:bg-destructive/5">
                          <TableCell className="font-medium max-w-[200px] truncate">{p.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
                          <TableCell className="text-center">{p.systemQty}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="destructive" className="font-mono">-{p.systemQty}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <Card>
        <CardContent className="p-5 flex flex-wrap gap-3">
          <Button
            onClick={onAdjustStock}
            disabled={adjusting || results.divergent.length === 0}
            className="gap-2 font-bold"
          >
            {adjusting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Ajustar estoque automaticamente
          </Button>
          <Button variant="outline" className="gap-2" onClick={onExportCSV}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button variant="outline" className="gap-2 border-primary/50 text-primary hover:bg-primary/5" onClick={onExportPDF}>
            <FileDown className="h-4 w-4" /> Exportar PDF (Audit)
          </Button>
          <Button variant="outline" onClick={onBackToScan} className="gap-2">
            Voltar à bipagem
          </Button>
          <Button variant="secondary" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Nova conferência
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
