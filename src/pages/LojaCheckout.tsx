import { useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { usePublicStore, usePublicStoreProducts } from "@/hooks/useStoreData";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CreditCard, QrCode, FileText, ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function LojaCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = searchParams.get("product");
  const spId = searchParams.get("sp");

  const { data: store, isLoading: storeLoading } = usePublicStore(slug);
  const { data: products, isLoading: productsLoading } = usePublicStoreProducts(store?.id);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Buyer data
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerCpf, setBuyerCpf] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "BOLETO" | "CREDIT_CARD">("PIX");

  // Payment result
  const [paymentResult, setPaymentResult] = useState<any>(null);

  const sp = products?.find(p => p.id === spId || p.product_id === productId);
  const product = sp?.products;

  if (storeLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!store || !sp || !product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Produto não encontrado</h1>
          <Button variant="outline" onClick={() => navigate(`/loja/${slug}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  const unitPrice = sp.custom_price ?? product.price;
  const totalPrice = Number(unitPrice) * quantity;

  const handleCheckout = async () => {
    if (!buyerName || !buyerEmail || !buyerCpf) {
      return toast.error("Preencha nome, e-mail e CPF");
    }

    setLoading(true);
    try {
      // 1. Create customer in Asaas
      const { data: custData, error: custError } = await supabase.functions.invoke("asaas-payment", {
        body: {
          action: "create-customer",
          name: buyerName,
          cpfCnpj: buyerCpf.replace(/\D/g, ""),
          email: buyerEmail,
          phone: buyerPhone,
        },
      });
      if (custError) throw custError;
      if (custData?.error) throw new Error(custData.error);
      const customerId = custData.customerId;

      // 2. Create payment
      const { data: payData, error: payError } = await supabase.functions.invoke("asaas-payment", {
        body: {
          action: "create-payment",
          customerId,
          billingType: paymentMethod,
          value: totalPrice,
          description: `${product.name} x${quantity} - ${store.store_name}`,
          externalReference: store.id,
        },
      });
      if (payError) throw payError;
      if (payData?.error) throw new Error(payData.error);

      // 3. Create order in database
      const orderNumber = `LJ-${Date.now().toString(36).toUpperCase()}`;
      const { error: orderError } = await supabase.from("store_orders").insert({
        store_id: store.id,
        order_number: orderNumber,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        buyer_cpf: buyerCpf,
        buyer_phone: buyerPhone || null,
        buyer_address: street ? { street, number, complement, neighborhood, city, state, zip_code: zipCode } : null,
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        shipping_cost: 0,
        payment_method: paymentMethod === "PIX" ? "pix" : paymentMethod === "BOLETO" ? "boleto" : "cartao",
        payment_status: "pendente",
        asaas_payment_id: payData.paymentId,
        asaas_customer_id: customerId,
        asaas_invoice_url: payData.invoiceUrl,
        asaas_pix_qrcode: payData.pixQrCode,
        asaas_pix_copy_paste: payData.pixCopyPaste,
        asaas_bank_slip_url: payData.bankSlipUrl,
      });
      if (orderError) throw orderError;

      setPaymentResult(payData);
      setStep(3);
      toast.success("Pedido criado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/loja/${slug}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-bold text-foreground">{store.store_name} — Checkout</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Product Summary */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{product.name}</p>
              <p className="text-sm text-muted-foreground">Qtd: {quantity}</p>
            </div>
            <p className="text-xl font-bold" style={{ color: store.primary_color }}>
              R$ {totalPrice.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Dados do Comprador</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome completo *</Label>
                  <Input value={buyerName} onChange={e => setBuyerName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail *</Label>
                  <Input type="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input value={buyerCpf} onChange={e => setBuyerCpf(e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} />
                </div>
              </div>
              <hr className="border-border" />
              <p className="text-sm font-medium text-muted-foreground">Endereço (opcional)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input value={zipCode} onChange={e => setZipCode(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Rua</Label>
                  <Input value={street} onChange={e => setStreet(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={number} onChange={e => setNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={complement} onChange={e => setComplement(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={state} onChange={e => setState(e.target.value)} maxLength={2} />
                </div>
              </div>
              <Button className="w-full" style={{ backgroundColor: store.primary_color }} onClick={() => {
                if (!buyerName || !buyerEmail || !buyerCpf) return toast.error("Preencha os campos obrigatórios");
                setStep(2);
              }}>
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Forma de Pagamento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={paymentMethod} onValueChange={v => setPaymentMethod(v as any)} className="space-y-3">
                {[
                  { value: "PIX", label: "PIX", desc: "Pagamento instantâneo", icon: QrCode },
                  { value: "BOLETO", label: "Boleto Bancário", desc: "Vencimento em 3 dias", icon: FileText },
                  { value: "CREDIT_CARD", label: "Cartão de Crédito", desc: "Aprovação imediata", icon: CreditCard },
                ].map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMethod === opt.value ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <RadioGroupItem value={opt.value} />
                    <opt.icon className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-sm text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button
                  className="flex-1"
                  style={{ backgroundColor: store.primary_color }}
                  onClick={handleCheckout}
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Finalizar Pedido — R$ {totalPrice.toFixed(2)}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && paymentResult && (
          <Card>
            <CardHeader><CardTitle>Pagamento</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-center">
              {paymentMethod === "PIX" && paymentResult.pixQrCode && (
                <>
                  <img src={`data:image/png;base64,${paymentResult.pixQrCode}`} alt="QR Code PIX" className="mx-auto w-48 h-48" />
                  {paymentResult.pixCopyPaste && (
                    <div className="flex items-center gap-2 justify-center">
                      <code className="text-xs bg-muted p-2 rounded max-w-xs truncate">{paymentResult.pixCopyPaste}</code>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(paymentResult.pixCopyPaste)}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </>
              )}
              {paymentMethod === "BOLETO" && paymentResult.bankSlipUrl && (
                <Button asChild>
                  <a href={paymentResult.bankSlipUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4 mr-2" /> Abrir Boleto
                  </a>
                </Button>
              )}
              {paymentResult.invoiceUrl && (
                <Button variant="outline" asChild>
                  <a href={paymentResult.invoiceUrl} target="_blank" rel="noopener noreferrer">
                    Ver Fatura Completa
                  </a>
                </Button>
              )}
              <p className="text-muted-foreground text-sm">Aguardando confirmação de pagamento...</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
