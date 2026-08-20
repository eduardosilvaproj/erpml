import { useState, useEffect } from "react";
import { Package, Minus, Plus, Search, ArrowRightLeft, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { stockService } from "@/services/stock";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_physical: number;
  stock_full: number;
}

export default function AjusteEstoque() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

  // Produtos e Busca
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searching, setSearching] = useState(false);

  // Formulário de Ajuste
  const [stockType, setStockType] = useState<"stock_physical" | "stock_full">("stock_physical");
  const [operation, setOperation] = useState<"entrada" | "saida">("entrada");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // 1. Buscar company_id do usuário logado
  useEffect(() => {
    async function fetchCompanyId() {
      if (!user) {
        setLoadingCompany(false);
        return;
      }
      try {
        // Tentar via profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.company_id) {
          setCompanyId(profile.company_id);
        } else {
          // Tentar via company_members
          const { data: member } = await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (member?.company_id) {
            setCompanyId(member.company_id);
          }
        }
      } catch (err: any) {
        console.error("Erro ao carregar empresa:", err.message);
      } finally {
        setLoadingCompany(false);
      }
    }
    fetchCompanyId();
  }, [user]);

  // 2. Buscar produtos com autocomplete (name + sku)
  useEffect(() => {
    if (!companyId) return;

    async function searchProducts() {
      setSearching(true);
      try {
        let query = supabase
          .from("products")
          .select("id, name, sku, stock_physical, stock_full")
          .eq("company_id", companyId)
          .limit(10);

        if (searchTerm.trim()) {
          query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        setProducts(data || []);
      } catch (err: any) {
        console.error("Erro ao buscar produtos:", err.message);
      } finally {
        setSearching(false);
      }
    }

    const timer = setTimeout(() => {
      searchProducts();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, companyId]);

  // Saldo atual do produto selecionado
  const currentStock = selectedProduct
    ? stockType === "stock_physical"
      ? selectedProduct.stock_physical || 0
      : selectedProduct.stock_full || 0
    : 0;

  // 7. Confirmação e Execução do Ajuste
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !companyId) return;

    if (quantity <= 0 || !Number.isInteger(quantity)) {
      toast({
        title: "Quantidade inválida",
        description: "Informe um número inteiro positivo.",
        variant: "destructive",
      });
      return;
    }

    if (operation === "saida" && quantity > currentStock) {
      toast({
        title: "Estoque insuficiente",
        description: `A quantidade solicitada (${quantity}) é maior que o saldo atual (${currentStock}).`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const oldStock = currentStock;
      const calculatedNewStock = operation === "entrada" ? oldStock + quantity : oldStock - quantity;

      if (calculatedNewStock < 0) {
        throw new Error("O estoque não pode ficar negativo.");
      }

      // Executar atualização no Supabase com base no tipo de estoque e operação
      if (stockType === "stock_physical") {
        if (operation === "entrada") {
          // Usar ajustarFisico ou update direto
          await stockService.ajustarFisico(
            selectedProduct.id,
            calculatedNewStock,
            companyId,
            notes.trim() || "Ajuste manual de entrada (Físico)"
          );
        } else {
          // Saída Físico
          await stockService.darBaixa(selectedProduct.id, quantity, companyId);
        }
      } else {
        // Estoque Full
        if (operation === "entrada") {
          await stockService.creditarFull(selectedProduct.id, quantity, companyId);
        } else {
          const res = await stockService.darBaixaFull(
            selectedProduct.id,
            quantity,
            companyId,
            undefined,
            notes.trim() || "Ajuste manual de saída (Full)"
          );
          if (res && res.error) {
            throw new Error(res.error);
          }
        }
      }

      // Registrar explicitamente log adicional com tipo "ajuste manual" e user_id
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      await supabase.from("stock_movement_logs").insert({
        product_id: selectedProduct.id,
        company_id: companyId,
        user_id: currentUser?.id,
        type: "ajuste",
        quantity: operation === "entrada" ? quantity : -quantity,
        old_stock: oldStock,
        new_stock: calculatedNewStock,
        stock_type: stockType === "stock_physical" ? "physical" : "full",
        reference_type: "manual",
        notes: notes.trim() || `Ajuste manual (${operation}): ${quantity}`
      });

      // Atualizar estado local do produto selecionado
      const updatedProduct = {
        ...selectedProduct,
        [stockType]: calculatedNewStock
      };
      setSelectedProduct(updatedProduct);
      setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));

      toast({
        title: "Ajuste realizado com sucesso!",
        description: `Estoque ${stockType === "stock_physical" ? "Físico" : "Full"} atualizado de ${oldStock} para ${calculatedNewStock}.`,
      });

      // Reset parcial
      setQuantity(1);
      setNotes("");
    } catch (err: any) {
      console.error("Erro ao realizar ajuste de estoque:", err);
      toast({
        title: "Falha ao ajustar estoque",
        description: err.message || "Erro desconhecido ao processar a operação.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCompany) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando dados da empresa...
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-700 max-w-xl mx-auto mt-10 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-5 w-5" /> Empresa não identificada
        </div>
        <p className="text-sm">
          Não foi possível associar seu usuário a nenhuma empresa ativa. Verifique seu cadastro ou entre em contato com o suporte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ajuste de Estoque Manual</h1>
        <p className="text-sm text-muted-foreground">
          Adicione ou retire unidades do estoque físico ou full com registro completo de auditoria.
        </p>
      </div>

      <form onSubmit={handleConfirm} className="rounded-xl border bg-card p-6 space-y-6 shadow-sm">
        {/* 3. Seleção de Produto (Autocomplete) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Produto</label>
          {selectedProduct ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
              <div>
                <p className="font-medium text-foreground">{selectedProduct.name}</p>
                <p className="text-xs text-muted-foreground">SKU: {selectedProduct.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedProduct(null);
                  setSearchTerm("");
                }}
                className="text-xs text-primary hover:underline font-medium"
              >
                Trocar produto
              </button>
            </div>
          ) : (
            <div className="relative space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Digite o nome ou SKU do produto..."
                  className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Lista de Sugestões / Dropdown */}
              {products.length > 0 && (
                <div className="absolute z-10 w-full rounded-lg border bg-popover shadow-md max-h-60 overflow-y-auto">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p);
                        setProducts([]);
                      }}
                      className="cursor-pointer px-3 py-2.5 text-sm hover:bg-muted transition-colors border-b last:border-0"
                    >
                      <p className="font-medium text-foreground">{p.name}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                        <span>SKU: {p.sku}</span>
                        <span>Físico: {p.stock_physical ?? 0}</span>
                        <span>Full: {p.stock_full ?? 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Exibir saldo atual do produto selecionado */}
        {selectedProduct && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center justify-between text-sm">
            <div>
              <p className="text-muted-foreground">Saldo Atual ({stockType === "stock_physical" ? "Estoque Físico" : "Estoque Full"}):</p>
              <p className="text-xl font-bold text-primary">{currentStock} unidades</p>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              <p>Físico: {selectedProduct.stock_physical ?? 0}</p>
              <p>Full: {selectedProduct.stock_full ?? 0}</p>
            </div>
          </div>
        )}

        {/* 4. Seletor de Tipo de Estoque */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Tipo de Estoque</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStockType("stock_physical")}
              className={`rounded-lg border p-3 text-sm font-medium transition-all ${
                stockType === "stock_physical"
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Estoque Físico
            </button>
            <button
              type="button"
              onClick={() => setStockType("stock_full")}
              className={`rounded-lg border p-3 text-sm font-medium transition-all ${
                stockType === "stock_full"
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Estoque Full
            </button>
          </div>
        </div>

        {/* 5. Seletor de Operação */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Operação</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setOperation("entrada")}
              className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                operation === "entrada"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <Plus className="h-4 w-4" /> Adicionar (Entrada)
            </button>
            <button
              type="button"
              onClick={() => setOperation("saida")}
              className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-all ${
                operation === "saida"
                  ? "border-rose-500 bg-rose-500/10 text-rose-600"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <Minus className="h-4 w-4" /> Retirar (Saída)
            </button>
          </div>
        </div>

        {/* 7. Campo Quantidade */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Quantidade</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="rounded-lg border p-2.5 text-muted-foreground hover:bg-muted"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-28 rounded-lg border bg-background px-3 py-2 text-center text-base font-semibold outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="rounded-lg border p-2.5 text-muted-foreground hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {operation === "saida" && quantity > currentStock && (
            <p className="text-xs text-rose-500 font-medium mt-1">
              Atenção: A quantidade excede o saldo atual ({currentStock}). A operação será bloqueada.
            </p>
          )}
        </div>

        {/* Observações / Motivo */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Motivo / Observações (Opcional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Correção de inventário, avaria, ajuste manual..."
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Botão de Confirmação */}
        <button
          type="submit"
          disabled={!selectedProduct || submitting || (operation === "saida" && quantity > currentStock)}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <ArrowRightLeft className="h-4 w-4" />
          {submitting ? "Processando Ajuste..." : "Confirmar Ajuste de Estoque"}
        </button>
      </form>
    </div>
  );
}
