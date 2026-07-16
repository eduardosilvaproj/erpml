import { useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts } from "@/hooks/useProductData";

interface ReturnFormProps {
  onSubmit: (data: {
    ml_order_id?: string; motivo?: string; notes?: string;
    items: { product_id: string; nome_produto: string; sku?: string; expected_quantity: number }[];
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export const ReturnForm = ({ onSubmit, onCancel, isSaving }: ReturnFormProps) => {
  const [mlOrderId, setMlOrderId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ product_id: string; nome_produto: string; sku: string; expected_quantity: number }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  const { data: products } = useProducts({ pageSize: 200, sortBy: "name", sortOrder: "asc" });

  const filteredProducts = products?.filter((p: any) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.ean?.includes(productSearch)
  ).slice(0, 10);

  const addProduct = (product: any) => {
    if (items.some((i) => i.product_id === product.id)) return;
    setItems([...items, { product_id: product.id, nome_produto: product.name, sku: product.sku || "", expected_quantity: 1 }]);
    setShowProductPicker(false);
    setProductSearch("");
  };

  const removeProduct = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateQty = (idx: number, qty: number) => setItems(items.map((item, i) => i === idx ? { ...item, expected_quantity: qty } : item));

  const handleSubmit = () => {
    if (items.length === 0) return;
    onSubmit({ ml_order_id: mlOrderId || undefined, motivo: motivo || undefined, notes: notes || undefined, items });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">ID do Pedido ML (opcional)</Label>
        <Input value={mlOrderId} onChange={(e) => setMlOrderId(e.target.value)} placeholder="Ex: 1234567890" />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Motivo</Label>
        <Select value={motivo} onValueChange={setMotivo}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o motivo..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buyer_return">Devolução por arrependimento</SelectItem>
            <SelectItem value="defective">Produto com defeito</SelectItem>
            <SelectItem value="wrong_item">Produto errado</SelectItem>
            <SelectItem value="damaged">Produto danificado</SelectItem>
            <SelectItem value="not_received">Não recebido</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Produtos</Label>
        <div className="space-y-2 mt-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
              <span className="flex-1 text-sm truncate">{item.nome_produto}</span>
              <Input
                type="number"
                value={item.expected_quantity}
                onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                className="w-16 h-8 text-center"
                min={1}
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeProduct(idx)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {showProductPicker ? (
          <div className="mt-2 space-y-1 border rounded-lg p-2">
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar produto..."
              className="h-8 text-sm"
              autoFocus
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {filteredProducts?.map((p: any) => (
                <button
                  key={p.id}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                  onClick={() => addProduct(p)}
                >
                  {p.name} <span className="text-muted-foreground">({p.sku || p.ean})</span>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowProductPicker(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full mt-2 gap-1" onClick={() => setShowProductPicker(true)}>
            <Plus className="h-3.5 w-3.5" /> Adicionar Produto
          </Button>
        )}
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Observações</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações opcionais..." rows={2} />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={items.length === 0 || isSaving}>
          {isSaving ? "Criando..." : "Criar Devolução"}
        </Button>
      </DialogFooter>
    </div>
  );
};