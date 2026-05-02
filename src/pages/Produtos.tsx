import { useState, useCallback, useEffect, useRef } from "react";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useNavigate, useLocation } from "react-router-dom";
import { Package, Plus, Search, Pencil, Trash2, Loader2, Sparkles, Upload, Download, Settings2, AlertTriangle, ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useProductsInfinite, useCategories, useSuppliers, useDeleteProduct, type Product } from "@/hooks/useProductData";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { useBarcodeSearch } from "@/hooks/useBarcodeSearch";
import { BarcodeSearchDialogs } from "@/components/barcode/BarcodeSearchDialogs";

const Produtos = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const barcodeSearch = useBarcodeSearch();
  const [barcodeInput, setBarcodeInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [correctionFilter, setCorrectionFilter] = useState<string>("");
  
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useProductsInfinite({
    search: search || undefined,
    category_id: categoryFilter || undefined,
    status: statusFilter as any,
    needsCorrection: correctionFilter as any,
  });

  const { targetRef, isIntersecting } = useIntersectionObserver();

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allProducts = data?.pages.flatMap(page => page.products) || [];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="products">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
            <p className="text-muted-foreground text-sm">Gerencie seu catálogo</p>
          </div>
        </div>

        <TabsContent value="products" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou código..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  allProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.sku}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>R$ {p.price.toFixed(2)}</TableCell>
                      <TableCell>{p.stock_physical}</TableCell>
                      <TableCell><Badge>{p.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div ref={targetRef} className="p-4 text-center">
              {isFetchingNextPage ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : hasNextPage ? "Carregando mais..." : "Fim da lista"}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Produtos;
