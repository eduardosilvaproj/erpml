import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Loader2, Eye, Package } from "lucide-react";
import { useMyStore, useStoreOrders, StoreOrder } from "@/hooks/useStoreData";

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  pago: "bg-green-500/10 text-green-600 border-green-500/20",
  cancelado: "bg-red-500/10 text-red-600 border-red-500/20",
  expirado: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

const statusLabels: Record<string, string> = {
  pendente: "Aguardando",
  pago: "Pago",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  cartao: "Cartão",
  boleto: "Boleto",
};

export default function MinhaLojaPedidos() {
  const { data: store, isLoading: storeLoading } = useMyStore();
  const { data: orders, isLoading: ordersLoading } = useStoreOrders(store?.id);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);

  if (storeLoading || ordersLoading) {
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
        <p className="text-muted-foreground">Configure sua loja primeiro</p>
      </div>
    );
  }

  const filtered = (orders || []).filter(o =>
    statusFilter === "all" || o.payment_status === statusFilter
  );

  return (
    <div className="op -m-4 min-h-screen space-y-3 p-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" /> Pedidos da Loja
        </h1>
        <p className="text-muted-foreground">Pedidos recebidos pela sua loja virtual</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Aguardando</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="expirado">Expirado</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary">{filtered.length} pedidos</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-50" />
              Nenhum pedido encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(order => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">{order.order_number}</TableCell>
                    <TableCell>{order.buyer_name}</TableCell>
                    <TableCell>{order.product_name}</TableCell>
                    <TableCell>R$ {Number(order.total_price).toFixed(2)}</TableCell>
                    <TableCell>{order.payment_method ? paymentLabels[order.payment_method] : "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[order.payment_status]}>
                        {statusLabels[order.payment_status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(order.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pedido #{selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Comprador</p>
                  <p className="font-medium">{selectedOrder.buyer_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">E-mail</p>
                  <p>{selectedOrder.buyer_email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CPF</p>
                  <p>{selectedOrder.buyer_cpf}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p>{selectedOrder.buyer_phone || "-"}</p>
                </div>
              </div>
              <hr className="border-border" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Produto</p>
                  <p className="font-medium">{selectedOrder.product_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Quantidade</p>
                  <p>{selectedOrder.quantity}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor Unitário</p>
                  <p>R$ {Number(selectedOrder.unit_price).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Frete</p>
                  <p>R$ {Number(selectedOrder.shipping_cost).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold text-lg">R$ {Number(selectedOrder.total_price).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={statusColors[selectedOrder.payment_status]}>
                    {statusLabels[selectedOrder.payment_status]}
                  </Badge>
                </div>
              </div>
              {selectedOrder.buyer_address && (
                <>
                  <hr className="border-border" />
                  <div>
                    <p className="text-muted-foreground mb-1">Endereço</p>
                    <p>
                      {(selectedOrder.buyer_address as any).street}, {(selectedOrder.buyer_address as any).number}
                      {(selectedOrder.buyer_address as any).complement && ` - ${(selectedOrder.buyer_address as any).complement}`}
                    </p>
                    <p>{(selectedOrder.buyer_address as any).neighborhood} - {(selectedOrder.buyer_address as any).city}/{(selectedOrder.buyer_address as any).state}</p>
                    <p>CEP: {(selectedOrder.buyer_address as any).zip_code}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
