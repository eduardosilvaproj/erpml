import { useState } from "react";
import { ChevronLeft, Download, FileSpreadsheet, ListFilter, RefreshCw, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

const CorrecaoSKU = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["sku-correction-stats"],
    queryFn: async () => {
      const { count: noSkuCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .or('sku.is.null,sku.eq.""');

      const { data: allProducts } = await supabase
        .from("products")
        .select("id")
        .eq("company_id", companyId);
      
      const { data: withSupplier } = await supabase
        .from("product_supplier_skus")
        .select("product_id")
        .eq("company_id", companyId);
      
      const withSupplierIds = new Set(withSupplier?.map(s => s.product_id) || []);
      const noSupplierCount = (allProducts?.length || 0) - withSupplierIds.size;

      return {
        noSkuCount: noSkuCount || 0,
        noSupplierCount: noSupplierCount || 0,
      };
    },
  });

  const generateSkusMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const { data: products, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("company_id", companyId)
        .or('sku.is.null,sku.eq.""')
        .order("name", { ascending: true });

      if (error) throw error;
      if (!products || products.length === 0) return 0;

      let count = 0;
      for (let i = 0; i < products.length; i++) {
        const skuNumber = (i + 1).toString().padStart(5, "0");
        const newSku = `SKU-${skuNumber}`;
        const { error: updateError } = await supabase
          .from("products")
          .update({ sku: newSku } as any)
          .eq("id", products[i].id)
          .eq("company_id", companyId);
        
        if (!updateError) count++;
      }
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["sku-correction-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "SKUs gerados com sucesso!",
        description: `${count} produtos receberam novos SKUs internos.`,
      });
      setIsGenerating(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar SKUs",
        description: error.message,
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      
      // Skip header if it exists (EAN, NOME_FORNECEDOR, SKU_FORNECEDOR)
      const dataLines = lines[0].includes("EAN") ? lines.slice(1) : lines;
      
      let processed = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const line of dataLines) {
        const [ean, supplierName, supplierSku] = line.split(",").map(s => s?.trim());
        
        if (ean && supplierName && supplierSku) {
          try {
            // Find product by barcode or ean
            const { data: product } = await supabase
              .from("products")
              .select("id")
              .eq("company_id", companyId)
              .or(`barcode.eq.${ean},ean.eq.${ean}`)
              .maybeSingle();

            if (product) {
              const { error } = await supabase
                .from("product_supplier_skus")
                .insert({
                  product_id: product.id,
                  supplier_name: supplierName,
                  supplier_sku: supplierSku,
                  company_id: companyId
                } as any);
              
              if (!error) successCount++;
              else errorCount++;
            } else {
              errorCount++;
            }
          } catch (err) {
            errorCount++;
          }
        }
        
        processed++;
        setImportProgress(Math.round((processed / dataLines.length) * 100));
      }

      setIsImporting(false);
      queryClient.invalidateQueries({ queryKey: ["sku-correction-stats"] });
      toast({
        title: "Importação concluída",
        description: `${successCount} SKUs importados, ${errorCount} erros/não encontrados.`,
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/produtos")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Correção de SKUs em Massa</h1>
            <p className="text-muted-foreground">Otimize seu catálogo e organize seus fornecedores</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Produtos sem SKU interno</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{isLoadingStats ? "..." : stats?.noSkuCount}</span>
              <AlertCircle className="h-8 w-8 text-amber-500 opacity-50" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Produtos que não possuem um código de identificação interno.</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Produtos sem fornecedor vinculado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{isLoadingStats ? "..." : stats?.noSupplierCount}</span>
              <ListFilter className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Produtos que ainda não possuem relação com nenhum fornecedor.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ações de Correção</CardTitle>
          <CardDescription>Escolha como deseja organizar seus SKUs e fornecedores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Button 
              variant="outline" 
              className="h-auto flex-col items-center gap-3 p-6 text-center hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200"
              onClick={() => generateSkusMutation.mutate()}
              disabled={isGenerating || stats?.noSkuCount === 0}
            >
              <div className="rounded-full bg-amber-100 p-3">
                <RefreshCw className={`h-6 w-6 text-amber-600 ${isGenerating ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <div className="font-bold">Gerar SKUs internos</div>
                <div className="text-xs font-normal text-muted-foreground mt-1">Gera SKU-00001 a SKU-XXXXX</div>
              </div>
            </Button>

            <div className="relative">
              <input
                type="file"
                id="csv-upload"
                className="hidden"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isImporting}
              />
              <Button 
                variant="outline" 
                className="h-auto w-full flex-col items-center gap-3 p-6 text-center hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                onClick={() => document.getElementById('csv-upload')?.click()}
                disabled={isImporting}
              >
                <div className="rounded-full bg-blue-100 p-3">
                  <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-bold">Importar via planilha</div>
                  <div className="text-xs font-normal text-muted-foreground mt-1">Vincular SKUs de fornecedor</div>
                </div>
              </Button>
            </div>

            <Button 
              variant="outline" 
              className="h-auto flex-col items-center gap-3 p-6 text-center hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
              onClick={() => navigate("/produtos?correction=no_sku")}
            >
              <div className="rounded-full bg-emerald-100 p-3">
                <ListFilter className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <div className="font-bold">Revisar manualmente</div>
                <div className="text-xs font-normal text-muted-foreground mt-1">Lista filtrável de produtos</div>
              </div>
            </Button>
          </div>

          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processando planilha...</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} />
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="flex items-center gap-2 font-medium text-sm mb-2">
              <FileSpreadsheet className="h-4 w-4" />
              Formato esperado para o CSV:
            </h4>
            <code className="block text-xs bg-background p-2 rounded border font-mono">
              EAN, NOME_FORNECEDOR, SKU_FORNECEDOR<br />
              7896014168590, L'oreal, LOR-MAJ-6.0<br />
              7898699842338, Kamaleão, KAM-FLAG-300
            </code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produtos Pendentes</CardTitle>
          <CardDescription>Lista de produtos que necessitam de atenção</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>EAN/Cód. Barras</TableHead>
                <TableHead>SKU Interno</TableHead>
                <TableHead>Fornecedores</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* This is just a preview of the first few products that need correction */}
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Use os filtros na tela de Produtos para revisar detalhadamente.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CorrecaoSKU;
