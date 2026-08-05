import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Loader2, Search, Eye } from "lucide-react";
import { useMyStore, useStoreProducts, useUpsertStoreProduct } from "@/hooks/useStoreData";
import { useProducts } from "@/hooks/useProductData";
import { toast } from "sonner";

export default function MinhaLojaProdutos() {
  const { data: store, isLoading: storeLoading } = useMyStore();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: storeProducts } = useStoreProducts(store?.id);
  const upsertProduct = useUpsertStoreProduct();
  const [search, setSearch] = useState("");

  if (storeLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="text-center py-16">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Loja não configurada</h2>
        <p className="text-muted-foreground">Configure sua loja primeiro em Minha Loja → Configurar</p>
      </div>
    );
  }

  const storeProductMap = new Map(
    (storeProducts || []).map(sp => [sp.product_id, sp])
  );

  const allProducts: any[] = products ? (Array.isArray(products) ? products : (products as any).products || []) : [];

  const filtered = allProducts.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = (productId: string, visible: boolean) => {
    const existing = storeProductMap.get(productId);
    upsertProduct.mutate({
      store_id: store.id,
      product_id: productId,
      is_visible: visible,
      custom_price: existing?.custom_price,
      custom_description: existing?.custom_description,
    });
  };

  const handlePriceChange = (productId: string, price: string) => {
    const existing = storeProductMap.get(productId);
    upsertProduct.mutate({
      store_id: store.id,
      product_id: productId,
      custom_price: price ? parseFloat(price) : null,
      is_visible: existing?.is_visible ?? true,
    });
  };

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Package className="h-6 w-6" /> Produtos da Loja
        </h1>
        <p className="text-muted-foreground">Gerencie quais produtos aparecem na sua vitrine</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Badge variant="secondary">{filtered.length} produtos</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Preço ERP</TableHead>
                <TableHead>Preço Loja</TableHead>
                <TableHead className="text-center">Exibir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(product => {
                const sp = storeProductMap.get(product.id);
                const isVisible = sp?.is_visible ?? false;
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                    <TableCell>R$ {Number(product.price).toFixed(2)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={Number(product.price).toFixed(2)}
                        defaultValue={sp?.custom_price ?? ""}
                        onBlur={e => handlePriceChange(product.id, e.target.value)}
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={isVisible}
                        onCheckedChange={v => handleToggle(product.id, v)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
