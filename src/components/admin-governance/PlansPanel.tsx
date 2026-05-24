import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Pencil, Plus, Check, X, Shield, Star, Crown, Zap } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useGovernancePlans, useAdminUpdatePlan } from "@/hooks/useGovernanceActions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export const PlansPanel = () => {
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planForm, setPlanForm] = useState<any>({});
  
  const { data: plans, isLoading } = useGovernancePlans();
  const updateMutation = useAdminUpdatePlan();

  const handleUpdate = async () => {
    if (!editingPlan) return;
    await updateMutation.mutateAsync({ id: editingPlan.id, ...planForm });
    setEditingPlan(null);
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case 'basic': return <Zap className="h-4 w-4 text-blue-500" />;
      case 'premium': return <Star className="h-4 w-4 text-orange-500" />;
      case 'enterprise': return <Crown className="h-4 w-4 text-amber-500" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planos da Plataforma</CardTitle>
        <CardDescription>Gerencie as ofertas comerciais e limites técnicos dos planos</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans?.map((plan: any) => (
              <Card key={plan.id} className={`relative overflow-hidden border-2 ${plan.slug === 'enterprise' ? 'border-amber-500/20' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    {getPlanIcon(plan.slug)}
                    <Badge variant={plan.is_active ? "default" : "secondary"}>{plan.is_active ? "Ativo" : "Inativo"}</Badge>
                  </div>
                  <CardTitle className="text-xl mt-2">{plan.name}</CardTitle>
                  <CardDescription className="text-2xl font-bold text-foreground">
                    {plan.price === 0 ? "Grátis" : formatCurrency(plan.price)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Usuários:</span>
                      <span className="font-medium">{plan.max_users}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Produtos:</span>
                      <span className="font-medium">{plan.max_products >= 99999 ? "Ilimitados" : plan.max_products}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Recursos</p>
                    <div className="grid grid-cols-1 gap-1">
                      {plan.features?.slice(0, 5).map((f: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Check className="h-3 w-3 text-green-500" />
                          <span className="truncate">{f}</span>
                        </div>
                      ))}
                      {plan.features?.length > 5 && (
                        <p className="text-[10px] text-muted-foreground mt-1">+{plan.features.length - 5} mais...</p>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-4" onClick={() => { setEditingPlan(plan); setPlanForm(plan); }}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar Plano
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!editingPlan} onOpenChange={() => setEditingPlan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Plano: {editingPlan?.name}</DialogTitle>
            <DialogDescription>Ajuste preços e limites do plano.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Preço Mensal (R$)</Label>
              <Input type="number" step="0.01" value={planForm.price ?? 0} onChange={(e) => setPlanForm({ ...planForm, price: parseFloat(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Máx. Usuários</Label>
                <Input type="number" value={planForm.max_users ?? 1} onChange={(e) => setPlanForm({ ...planForm, max_users: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Máx. Produtos</Label>
                <Input type="number" value={planForm.max_products ?? 50} onChange={(e) => setPlanForm({ ...planForm, max_products: parseInt(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 mt-4">
              <Label>Plano Ativo</Label>
              <Switch checked={!!planForm.is_active} onCheckedChange={(v) => setPlanForm({ ...planForm, is_active: v })} />
            </div>
            <p className="text-[10px] text-muted-foreground bg-muted p-2 rounded">
              Nota: Alterar o preço aqui não mudará assinaturas já existentes no Asaas automaticamente, apenas novos upgrades.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
