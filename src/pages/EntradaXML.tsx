import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  FileText, Upload, CheckCircle, AlertTriangle, Loader2, X, Package,
  ArrowRight, Check, XCircle, HelpCircle, ChevronDown, ChevronUp, Trash2, Files,
  Camera, Barcode, ChevronLeft, ChevronRight, Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { parseNFeXml, matchProducts, type NFeData, type MatchResult } from "@/lib/nfe-parser";
import { useInvoiceStats, useInvoices, useImportInvoice } from "@/hooks/useInvoiceData";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ImportStep = "upload" | "review" | "ean_registration" | "processing" | "done";

interface QueuedFile {
  id: string;
  file: File;
  status: "pending" | "parsing" | "parsed" | "error";
  nfeData?: NFeData;
  matches?: MatchResult[];
  error?: string;
}

interface ImportResult {
  fileName: string;
  nfeNumber: string;
  issuerName: string;
  totalItems: number;
  matchedCount: number;
  newCount: number;
  success: boolean;
  error?: string;
}

const EntradaXML = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>("upload");
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [createNewProducts, setCreateNewProducts] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentProcessing, setCurrentProcessing] = useState("");
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [expandedHistory, setExpandedHistory] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [itemsNeedingEan, setItemsNeedingEan] = useState<MatchResult[]>([]);
  const [currentEanIndex, setCurrentEanIndex] = useState(0);
  const [manualEan, setManualEan] = useState("");
  const [eanAlertShown, setEanAlertShown] = useState(false);
  const [skipPendingEan, setSkipPendingEan] = useState(false);
  const [registeredEans, setRegisteredEans] = useState<Record<string, string>>({});

  const { data: stats } = useInvoiceStats();
  const { data: invoices } = useInvoices();
  const importInvoice = useImportInvoice();

  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const xmlFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".xml"));
    const nonXml = Array.from(files).length - xmlFiles.length;

    if (nonXml > 0) {
      toast({
        title: `${nonXml} arquivo(s) ignorado(s)`,
        description: "Apenas arquivos XML são aceitos.",
        variant: "destructive",
      });
    }

    if (xmlFiles.length === 0) return;

    const newQueued: QueuedFile[] = xmlFiles.map((file) => ({
      id: generateId(),
      file,
      status: "pending" as const,
    }));

    setQueuedFiles((prev) => [...prev, ...newQueued]);

    // Parse each file
    const { data: dbProducts } = await supabase
      .from("products")
      .select("id, name, barcode, sku");

    for (const qf of newQueued) {
      setQueuedFiles((prev) =>
        prev.map((f) => (f.id === qf.id ? { ...f, status: "parsing" } : f))
      );

      try {
        const xmlString = await qf.file.text();
        const parsed = parseNFeXml(xmlString);
        const matchResults = matchProducts(parsed.products, dbProducts || []);

        setQueuedFiles((prev) =>
          prev.map((f) =>
            f.id === qf.id
              ? { ...f, status: "parsed", nfeData: parsed, matches: matchResults }
              : f
          )
        );
      } catch (err: any) {
        setQueuedFiles((prev) =>
          prev.map((f) =>
            f.id === qf.id ? { ...f, status: "error", error: err.message } : f
          )
        );
      }
    }
  }, [toast]);

  const removeFile = (id: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedFileId === id) setSelectedFileId(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const parsedFiles = queuedFiles.filter((f) => f.status === "parsed");
  const errorFiles = queuedFiles.filter((f) => f.status === "error");
  const parsingFiles = queuedFiles.filter((f) => f.status === "parsing" || f.status === "pending");

  const selectedFile = selectedFileId
    ? queuedFiles.find((f) => f.id === selectedFileId)
    : null;

  const totalMatched = parsedFiles.reduce(
    (sum, f) => sum + (f.matches?.filter((m) => m.matchType !== "none").length ?? 0),
    0
  );
  const totalNew = parsedFiles.reduce(
    (sum, f) => sum + (f.matches?.filter((m) => m.matchType === "none").length ?? 0),
    0
  );

  const goToReview = () => {
    if (parsedFiles.length === 0) {
      toast({ title: "Nenhum arquivo válido", description: "Adicione ao menos um XML válido.", variant: "destructive" });
      return;
    }

    const missingEan = parsedFiles.flatMap(f => 
      f.matches?.filter(m => !m.xmlProduct.ean && (!m.matchedProductEan && !m.matchedProductBarcode)) || []
    );

    if (missingEan.length > 0 && !eanAlertShown) {
      setItemsNeedingEan(missingEan);
      setEanAlertShown(true);
      return;
    }

    setStep("review");
  };

  const continueWithoutEans = () => {
    setSkipPendingEan(true);
    setStep("review");
  };


  const handleBiparEan = async (ean: string) => {
    if (!ean) return;
    
    const currentItem = itemsNeedingEan[currentEanIndex];
    if (!currentItem) return;

    // Save registration locally
    setRegisteredEans(prev => ({
      ...prev,
      [currentItem.xmlProduct.code]: ean
    }));

    setManualEan("");
    
    if (currentEanIndex < itemsNeedingEan.length - 1) {
      setCurrentEanIndex(prev => prev + 1);
    } else {
      setStep("review");
    }
  };

  const skipItem = () => {
    if (currentEanIndex < itemsNeedingEan.length - 1) {
      setCurrentEanIndex(prev => prev + 1);
    } else {
      setStep("review");
    }
  };

  const prevItem = () => {
    if (currentEanIndex > 0) {
      setCurrentEanIndex(prev => prev - 1);
    }
  };

  const handleImportAll = async () => {
    setStep("processing");
    setProgress(0);
    const results: ImportResult[] = [];
    const total = parsedFiles.length;

    for (let i = 0; i < total; i++) {
      const qf = parsedFiles[i];
      if (!qf.nfeData || !qf.matches) continue;

      setCurrentProcessing(`${qf.nfeData.number} - ${qf.file.name}`);
      setProgress(Math.round(((i) / total) * 100));

      try {
        const updatedMatches = qf.matches.map(m => {
          const newEan = registeredEans[m.xmlProduct.code];
          return {
            ...m,
            newEan,
            eanPending: !m.xmlProduct.ean && !newEan && !m.matchedProductEan && !m.matchedProductBarcode
          };
        });

        await importInvoice.mutateAsync({
          nfeData: {
            number: qf.nfeData.number,
            series: qf.nfeData.series,
            issuerName: qf.nfeData.issuerName,
            issuerCnpj: qf.nfeData.issuerCnpj,
            totalValue: qf.nfeData.totalValue,
          },
          matches: updatedMatches,
          createNewProducts,
        });

        const matched = qf.matches.filter((m) => m.matchType !== "none").length;
        const newP = qf.matches.filter((m) => m.matchType === "none").length;
        results.push({
          fileName: qf.file.name,
          nfeNumber: qf.nfeData.number,
          issuerName: qf.nfeData.issuerName,
          totalItems: qf.matches.length,
          matchedCount: matched,
          newCount: newP,
          success: true,
        });
      } catch (err: any) {
        results.push({
          fileName: qf.file.name,
          nfeNumber: qf.nfeData?.number ?? "?",
          issuerName: qf.nfeData?.issuerName ?? "",
          totalItems: qf.matches?.length ?? 0,
          matchedCount: 0,
          newCount: 0,
          success: false,
          error: err.message,
        });
      }
    }

    setProgress(100);
    setImportResults(results);
    setStep("done");
  };

  const resetFlow = () => {
    setStep("upload");
    setQueuedFiles([]);
    setSelectedFileId(null);
    setProgress(0);
    setImportResults([]);
    setCurrentProcessing("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
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
        <div className="space-y-4">
          <Card>
            <CardContent className="p-8">
              <div
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12 transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-border"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload className={`mb-4 h-12 w-12 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground opacity-40"}`} />
                <p className="mb-2 text-lg font-medium text-foreground">
                  {dragOver ? "Solte os arquivos aqui" : "Arraste seus XMLs de Nota Fiscal aqui"}
                </p>
                <p className="mb-4 text-sm text-muted-foreground">Suporta múltiplos arquivos XML simultaneamente</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Selecionar XMLs
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* File queue list */}
          {queuedFiles.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Files className="h-5 w-5" />
                    Arquivos carregados ({queuedFiles.length})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setQueuedFiles([])}>
                      Limpar tudo
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {queuedFiles.map((qf) => (
                  <div
                    key={qf.id}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                      qf.status === "error"
                        ? "border-destructive/30 bg-destructive/5"
                        : qf.status === "parsed"
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-border"
                    } ${selectedFileId === qf.id ? "ring-2 ring-primary" : ""}`}
                  >
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => qf.status === "parsed" && setSelectedFileId(qf.id === selectedFileId ? null : qf.id)}
                    >
                      {qf.status === "pending" || qf.status === "parsing" ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
                      ) : qf.status === "parsed" ? (
                        <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{qf.file.name}</p>
                        {qf.status === "parsed" && qf.nfeData && (
                          <p className="text-xs text-muted-foreground">
                            NF-e #{qf.nfeData.number} • {qf.nfeData.issuerName} • {qf.nfeData.products.length} itens • {formatCurrency(qf.nfeData.totalValue)}
                          </p>
                        )}
                        {qf.status === "error" && (
                          <p className="text-xs text-destructive">{qf.error}</p>
                        )}
                        {(qf.status === "pending" || qf.status === "parsing") && (
                          <p className="text-xs text-muted-foreground">Processando...</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {qf.status === "parsed" && qf.matches && (
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {qf.matches.filter((m) => m.matchType !== "none").length} vinculados
                          </Badge>
                          {qf.matches.filter((m) => m.matchType === "none").length > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {qf.matches.filter((m) => m.matchType === "none").length} novos
                            </Badge>
                          )}
                        </div>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFile(qf.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Summary bar */}
                {parsedFiles.length > 0 && parsingFiles.length === 0 && (
                  <>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between">
                      <div className="flex gap-4 text-sm">
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">{parsedFiles.length}</strong> nota(s) válida(s)
                        </span>
                        {errorFiles.length > 0 && (
                          <span className="text-destructive">
                            <strong>{errorFiles.length}</strong> com erro
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          <strong className="text-emerald-600">{totalMatched}</strong> vinculados
                        </span>
                        <span className="text-muted-foreground">
                          <strong className="text-amber-600">{totalNew}</strong> novos
                        </span>
                      </div>
                      <Button onClick={goToReview} disabled={parsedFiles.length === 0}>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Revisar e Importar ({parsedFiles.length})
                      </Button>
                    </div>
                  </>
                )}

                {parsingFiles.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando {parsingFiles.length} arquivo(s)...
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Selected file detail */}
          {selectedFile?.status === "parsed" && selectedFile.nfeData && selectedFile.matches && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Detalhes: NF-e #{selectedFile.nfeData.number} — {selectedFile.file.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição XML</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedFile.matches.map((m, i) => (
                      <TableRow key={i} className={m.matchType === "none" ? "bg-destructive/5" : ""}>
                        <TableCell className="font-mono text-xs">{m.xmlProduct.code}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{m.xmlProduct.description}</TableCell>
                        <TableCell className="text-center">{m.xmlProduct.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(m.xmlProduct.unitValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(m.xmlProduct.totalValue)}</TableCell>
                        <TableCell>{matchBadge(m.matchType, m.confidence)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== MISSING EAN ALERT ===== */}
      {eanAlertShown && step === "upload" && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-bold">{itemsNeedingEan.length} produtos sem EAN detectados</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>Estes itens precisam ter o EAN cadastrado para entrar no estoque com rastreabilidade total.</p>
            <div className="flex gap-3">
              <Button onClick={continueWithoutEans} variant="outline" className="bg-background">
                <Check className="mr-2 h-4 w-4" /> Continuar os que têm EAN
              </Button>
              <Button onClick={startEanRegistration}>
                <Camera className="mr-2 h-4 w-4" /> Iniciar cadastro de EANs
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ===== EAN REGISTRATION STEP ===== */}
      {step === "ean_registration" && itemsNeedingEan.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Barcode className="h-5 w-5" />
                Vincular EANs — Nota Fiscal #{selectedFile?.nfeData?.number || "Múltiplas"}
              </h2>
              <p className="text-sm text-muted-foreground">Fornecedor: {selectedFile?.nfeData?.issuerName || "Vários"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">Progresso: {Object.keys(registeredEans).length}/{itemsNeedingEan.length} vinculados</p>
              <Progress value={(Object.keys(registeredEans).length / itemsNeedingEan.length) * 100} className="w-48 h-2" />
            </div>
          </div>

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Lista de Produtos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PRODUTO DA NOTA</TableHead>
                        <TableHead>SKU FORN.</TableHead>
                        <TableHead>EAN</TableHead>
                        <TableHead>STATUS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemsNeedingEan.map((item, idx) => {
                        const isDone = !!registeredEans[item.xmlProduct.code];
                        const isActive = idx === currentEanIndex;
                        return (
                          <TableRow 
                            key={idx} 
                            className={`${isActive ? "bg-primary/5 ring-1 ring-primary/20" : ""} ${isDone ? "opacity-60" : ""}`}
                            onClick={() => setCurrentEanIndex(idx)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {isDone ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : (isActive ? <ArrowRight className="h-4 w-4 text-primary animate-pulse" /> : <div className="w-4" />)}
                                {item.xmlProduct.description}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{item.xmlProduct.code}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {registeredEans[item.xmlProduct.code] || (isActive ? "[bipe aqui]" : "—")}
                            </TableCell>
                            <TableCell>
                              {isDone ? <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">OK</Badge> : (isActive ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline" className="opacity-40">Pendente</Badge>)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/50 ring-1 ring-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Produto atual para bipar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-secondary/50 p-4 border space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="rounded bg-primary/10 p-2">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold leading-tight">{itemsNeedingEan[currentEanIndex].xmlProduct.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">SKU Fornecedor: {itemsNeedingEan[currentEanIndex].xmlProduct.code}</p>
                      <p className="text-xs text-muted-foreground">Qtd na nota: {itemsNeedingEan[currentEanIndex].xmlProduct.quantity} unidades</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg bg-primary/5 border-primary/20 text-center">
                    <Barcode className="h-10 w-10 text-primary mb-2 opacity-40" />
                    <p className="text-sm font-medium">Bipe o EAN do produto agora</p>
                    <p className="text-xs text-muted-foreground">O leitor preencherá o campo abaixo</p>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        autoFocus
                        placeholder="Ou digite o EAN aqui..."
                        className="pl-9"
                        value={manualEan}
                        onChange={(e) => setManualEan(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleBiparEan(manualEan)}
                      />
                    </div>
                    <Button onClick={() => handleBiparEan(manualEan)} disabled={!manualEan}>OK</Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t bg-muted/30 pt-4">
                <Button variant="ghost" size="sm" onClick={prevItem} disabled={currentEanIndex === 0}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                </Button>
                <Button variant="ghost" size="sm" onClick={skipItem}>
                  Pular este item <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div className="flex justify-between items-center pt-4">
            <Button variant="ghost" onClick={() => setStep("upload")}>Cancelar e Voltar</Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={continueWithoutEans}>Finalizar Depois</Button>
              <Button onClick={() => setStep("review")} disabled={Object.keys(registeredEans).length === 0}>
                Revisar Nota <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== REVIEW STEP ===== */}
      {step === "review" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Files className="h-5 w-5" />
                  Revisão — {parsedFiles.length} nota(s) fiscal(is)
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
                  <X className="mr-1 h-4 w-4" /> Voltar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {parsedFiles.map((qf) => (
                  <div key={qf.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">
                          NF-e #{qf.nfeData!.number} — {qf.nfeData!.issuerName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {qf.nfeData!.products.length} itens • {formatCurrency(qf.nfeData!.totalValue)} •
                          CNPJ: {qf.nfeData!.issuerCnpj}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="secondary">
                        {qf.matches!.filter((m) => m.matchType !== "none").length} vinculados
                      </Badge>
                      {qf.matches!.filter((m) => m.matchType === "none").length > 0 && (
                        <Badge variant="destructive">
                          {qf.matches!.filter((m) => m.matchType === "none").length} novos
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Global settings */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Check className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Vinculados</p>
                  <p className="text-xl font-bold">{totalMatched}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <XCircle className="h-6 w-6 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Não Encontrados</p>
                  <p className="text-xl font-bold">{totalNew}</p>
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

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
            <Button onClick={handleImportAll}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Importar {parsedFiles.length} Nota(s)
            </Button>
          </div>
        </div>
      )}

      {/* ===== PROCESSING STEP ===== */}
      {step === "processing" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            <p className="mb-2 text-lg font-medium">Importando notas fiscais...</p>
            <p className="mb-2 text-sm text-muted-foreground">{currentProcessing}</p>
            <p className="mb-6 text-sm text-muted-foreground">
              {parsedFiles.length} nota(s) • {totalMatched + (createNewProducts ? totalNew : 0)} produto(s)
            </p>
            <Progress value={progress} className="max-w-md" />
            <p className="mt-2 text-sm text-muted-foreground">{progress}%</p>
          </CardContent>
        </Card>
      )}

      {/* ===== DONE STEP ===== */}
      {step === "done" && importResults.length > 0 && (
        <Card>
          <CardContent className="py-10">
            <div className="flex flex-col items-center mb-6">
              <div className="mb-4 rounded-full bg-emerald-100 p-4">
                <CheckCircle className="h-10 w-10 text-emerald-600" />
              </div>
              <p className="text-xl font-bold text-foreground">Importação concluída!</p>
              <p className="text-muted-foreground">
                {importResults.filter((r) => r.success).length} de {importResults.length} nota(s) importada(s) com sucesso
              </p>
            </div>

            <div className="space-y-2 max-w-2xl mx-auto">
              {importResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    r.success ? "border-emerald-200 bg-emerald-50/50" : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {r.success ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        NF-e #{r.nfeNumber} — {r.issuerName || r.fileName}
                      </p>
                      {r.success ? (
                        <p className="text-xs text-muted-foreground">
                          {r.totalItems} itens • {r.matchedCount} vinculados • {r.newCount} criados
                        </p>
                      ) : (
                        <p className="text-xs text-destructive">{r.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={resetFlow}>
                <Upload className="mr-2 h-4 w-4" />
                Importar Mais Notas
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
              <div className="overflow-x-auto">
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
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
};

export default EntradaXML;
