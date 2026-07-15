import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useCreateReturn } from "@/hooks/useDevolucoes";
import { useNavigate } from "react-router-dom";
import { ReturnSource } from "@/services/returns";

export function ReturnForm({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [source, setSource] = useState<ReturnSource>("manual");
  const [customer, setCustomer] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [motivo, setMotivo] = useState("");
  const [items, setItems] = useState([{ nome: "", sku: "", quantity: 1 }]);
  const create = useCreateReturn();
  const navigate = useNavigate();

  const submit = async () => {
    const valid = items.filter(i => i.nome.trim() && i.quantity > 0);
    if (valid.length === 0) return;
    const ret = await create.mutateAsync({
      companyId: "",
      source,
      customerName: customer || undefined,
      orderReference: orderRef || undefined,
      motivo: motivo || undefined,
      items: valid,
    });
    onOpenChange(false);
    setCustomer(""); setOrderRef(""); setMotivo("");
    setItems([{ nome: "", sku: "", quantity: 1 }]);
    if (ret?.id) navigate(`/devolucoes/${ret.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Devolução</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Origem</Label>
              <Select value={source} onValueChange={(v) => setSource(v as ReturnSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
                  <SelectItem value="loja">Minha Loja</SelectItem>
                  <SelectItem value="pdv">PDV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referência do pedido</Label>
              <Input value={orderRef} onChange={e => setOrderRef(e.target.value)} placeholder="Ex.: ML123456" />
            </div>
          </div>
          <div>
            <Label>Cliente</Label>
            <Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div>
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo da devolução" rows={2} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Itens devolvidos</Label>
              <Button size="sm" variant="ghost" onClick={() => setItems([...items, { nome: "", sku: "", quantity: 1 }])}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    <Input placeholder="Nome do produto" value={it.nome}
                      onChange={e => setItems(items.map((x, k) => k === i ? { ...x, nome: e.target.value } : x))} />
                  </div>
                  <div className="col-span-3">
                    <Input placeholder="SKU / EAN" value={it.sku}
                      onChange={e => setItems(items.map((x, k) => k === i ? { ...x, sku: e.target.value } : x))} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min={1} value={it.quantity}
                      onChange={e => setItems(items.map((x, k) => k === i ? { ...x, quantity: Number(e.target.value) || 1 } : x))} />
                  </div>
                  <div className="col-span-1">
                    <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, k) => k !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? "Criando..." : "Criar devolução"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
