import { useState, useRef, useCallback } from "react";
import {
  FileText, Upload, CheckCircle, AlertTriangle, Loader2, X, Package,
  ArrowRight, Check, XCircle, HelpCircle, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { parseNFeXml, matchProducts, type NFeData, type MatchResult } from "@/lib/nfe-parser";
import { useInvoiceStats, useInvoices, useImportInvoice } from "@/hooks/useInvoiceData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ImportStep = "upload" | "review" | "processing" | "done";

const EntradaXML = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [nfeData, setNfeData] = useState<NFeData | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [createNewProducts, setCreateNewProducts] = useState(true);
  const [progress, setProgress] = useState(0);
  const [expandedHistory, setExpandedHistory] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: stats } = useInvoiceStats();
  const { data: invoices } = useInvoices();
  const importInvoice = useImportInvoice();

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast({ title: "Arquivo inválido", description: "Selecione um arquivo XML.", variant: "destructive" });
      return;
    }

    try {
      const xmlString = await file.text();
      const parsed = parseNFeXml(xmlString);
      setNfeData(parsed);

      // Fetch existing products for matching
      const { data: dbProducts } = await supabase
        .from("products")
        .select("id, name, barcode, sku");

      const matchResults = matchProducts(parsed.products, dbProducts || []);
      setMatches(matchResults);
      setStep("review");
    } catch (err: any) {
      toast({ title: "Erro ao ler XML", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    if (!nfeData) return;
    setStep("processing");
    setProgress(10);

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 85));
    }, 300);

    try {
      await importInvoice.mutateAsync({
        nfeData: {
          number: nfeData.number,
          series: nfeData.series,
          issuerName: nfeData.issuerName,
          issuerCnpj: nfeData.issuerCnpj,
          totalValue: nfeData.totalValue,
        },
        matches,
        createNewProducts,
      });
      setProgress(100);
      setStep("done");
    } catch {
      setStep("review");
    } finally {
      clearInterval(interval);
    }
  };

  const resetFlow = () => {
    setStep("upload");
    setNfeData(null);
    setMatches([]);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const matchedCount = matches.filter((m) => m.matchType === "exact" || m.matchType === "fuzzy").length;
  const newCount = matches.filter((m) => m.matchType === "none").length;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const matchBadge = (type: string, confidence: number) => {
    switch (type) {
      case "exact":
        return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200">Exato</Badge>;
      case "fuzzy":
        return <Badge className="bg-amber-500/15 text-amber-700 border-amber-200">Fuzzy {confidence}%</Badge>;
      case "none":
        return <Badge variant="destructive">Novo</Badge>;
      default:
        return <Badge variant="secondary">—</Badge>;
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; class: string }> = {
      importada: { label: "Importada", class: "bg-primary/10 text-primary" },
      aguardando_conferencia: { label: "Aguardando", class: "bg-amber-500/15 text-amber-700" },
      conferida: { label: "Conferida", class: "bg-emerald-500/15 text-emerald-700" },
      divergente: { label: "Divergente", class: "bg-destructive/15 text-destructive" },
    };
    const s = map[status] || map.importada;
    return <Badge className={s.class}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Entrada via XML</h1>
        <p className="text-muted-foreground">Importe notas fiscais e atualize estoque automaticamente</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Notas Importadas", value: stats?.total ?? 0, icon: FileText },
          { label: "Aguardando Conferência", value: stats?.aguardando ?? 0, icon: AlertTriangle },
          { label: "Conferidas", value: stats?.conferida ?? 0, icon: CheckCircle },
          { label: "Divergentes", value: stats?.divergente ?? 0, icon: AlertTriangle },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ===== UPLOAD STEP ===== */}
      {step === "upload" && (
        <Card>
          <CardContent className="p-8">
            <div
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className={`mb-4 h-12 w-12 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground opacity-40"}`} />
              <p className="mb-2 text-lg font-medium text-foreground">
                {dragOver ? "Solte o arquivo aqui" : "Arraste o XML da Nota Fiscal aqui"}
              </p>
              <p className="mb-4 text-sm text-muted-foreground">ou clique para selecionar o arquivo</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Selecionar XML
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== REVIEW STEP ===== */}
      {step === "review" && nfeData && (
        <div className="space-y-4">
          {/* NF-e header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  NF-e #{nfeData.number} | Série {nfeData.series}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={resetFlow}>
                  <X className="mr-1 h-4 w-4" /> Cancelar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Emitente</p>
                  <p className="font-medium">{nfeData.issuerName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CNPJ</p>
                  <p className="font-mono">{nfeData.issuerCnpj || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor Total</p>
                  <p className="font-bold text-lg">{formatCurrency(nfeData.totalValue)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Itens</p>
                  <p className="font-bold text-lg">{nfeData.products.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Match summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Check className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Vinculados</p>
                  <p className="text-xl font-bold">{matchedCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <XCircle className="h-6 w-6 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">Não encontrados</p>
                  <p className="text-xl font-bold">{newCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex items-center gap-2">
                  <Switch checked={createNewProducts} onCheckedChange={setCreateNewProducts} />
                  <div>
                    <p className="text-sm font-medium">Criar produtos novos</p>
                    <p className="text-xs text-muted-foreground">Auto-cadastrar não encontrados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items table */}
          <Card>
            <CardHeader>
              <CardTitle>Itens da Nota Fiscal</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição XML</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Valor Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Produto Vinculado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((m, i) => (
                    <TableRow key={i} className={m.matchType === "none" ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{m.xmlProduct.code}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{m.xmlProduct.description}</TableCell>
                      <TableCell className="text-center">{m.xmlProduct.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.xmlProduct.unitValue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.xmlProduct.totalValue)}</TableCell>
                      <TableCell>{matchBadge(m.matchType, m.confidence)}</TableCell>
                      <TableCell className="text-sm">
                        {m.matchedProductName ? (
                          <span className="text-emerald-700">{m.matchedProductName}</span>
                        ) : (
                          <span className="text-muted-foreground italic">
                            {createNewProducts ? "Será criado" : "Não vinculado"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={resetFlow}>Cancelar</Button>
            <Button onClick={handleImport}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Importar e Atualizar Estoque
            </Button>
          </div>
        </div>
      )}

      {/* ===== PROCESSING STEP ===== */}
      {step === "processing" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            <p className="mb-2 text-lg font-medium">Importando nota fiscal...</p>
            <p className="mb-6 text-sm text-muted-foreground">
              Atualizando estoque de {matchedCount + (createNewProducts ? newCount : 0)} produto(s)
            </p>
            <Progress value={progress} className="max-w-md" />
            <p className="mt-2 text-sm text-muted-foreground">{progress}%</p>
          </CardContent>
        </Card>
      )}

      {/* ===== DONE STEP ===== */}
      {step === "done" && nfeData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 rounded-full bg-emerald-100 p-4">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <p className="mb-2 text-xl font-bold text-foreground">Importação concluída!</p>
            <p className="mb-1 text-muted-foreground">
              NF-e #{nfeData.number} • {nfeData.issuerName}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{matches.length}</p>
                <p className="text-xs text-muted-foreground">Itens processados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{matchedCount}</p>
                <p className="text-xs text-muted-foreground">Estoque atualizado</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{createNewProducts ? newCount : 0}</p>
                <p className="text-xs text-muted-foreground">Produtos criados</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={resetFlow}>
                <Upload className="mr-2 h-4 w-4" />
                Importar Outra Nota
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== HISTORY ===== */}
      {invoices && invoices.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() => setExpandedHistory(!expandedHistory)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Histórico de Importações ({invoices.length})</CardTitle>
              {expandedHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          {expandedHistory && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº NF-e</TableHead>
                    <TableHead>Emitente</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono">{inv.number}</TableCell>
                      <TableCell>{inv.issuer_name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.issuer_cnpj || "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.total_value)}</TableCell>
                      <TableCell className="text-center">{inv.items_count}</TableCell>
                      <TableCell>{statusBadge(inv.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
};

export default EntradaXML;
