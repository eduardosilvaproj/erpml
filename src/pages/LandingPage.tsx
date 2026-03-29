import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package, ScanBarcode, BarChart3, Truck, RefreshCw,
  DollarSign, ClipboardList, Monitor, Users, ArrowRight,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, Zap,
  Shield, Clock, TrendingUp, AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const painPoints = [
  { icon: XCircle, text: "Erro na conferência de mercadoria" },
  { icon: AlertTriangle, text: "Estoque desatualizado no Mercado Livre" },
  { icon: DollarSign, text: "Perda de vendas por falta de controle" },
  { icon: RefreshCw, text: "Confusão entre estoque físico e Full" },
  { icon: Clock, text: "Tempo perdido em processos manuais" },
];

const features = [
  {
    icon: Package, title: "Entrada automática via XML",
    desc: "Importe notas fiscais e atualize o estoque automaticamente. Sem digitação, sem erro.",
  },
  {
    icon: ScanBarcode, title: "Conferência com leitor de código de barras",
    desc: "Valide produtos com bip e elimine erros na conferência de mercadoria.",
  },
  {
    icon: BarChart3, title: "Controle de estoque físico e Full",
    desc: "Separe e gerencie corretamente os dois estoques em tempo real.",
  },
  {
    icon: Truck, title: "Envio para Full com controle por bip",
    desc: "Separe e envie produtos com segurança e agilidade total.",
  },
  {
    icon: RefreshCw, title: "Integração automática com Mercado Livre",
    desc: "Baixa automática de estoque a cada venda. Sem intervenção manual.",
  },
  {
    icon: DollarSign, title: "Controle de custo e lucro",
    desc: "Saiba exatamente quanto está ganhando em cada produto e operação.",
  },
  {
    icon: ClipboardList, title: "Cadastro inteligente de produtos",
    desc: "Controle origem, múltiplos fornecedores e enriqueça dados com IA.",
  },
  {
    icon: Monitor, title: "PDV integrado",
    desc: "Venda direto com leitor de código de barras e controle total.",
  },
  {
    icon: Users, title: "CRM de clientes",
    desc: "Controle histórico, relacionamento e fidelize seus compradores.",
  },
];

const benefits = [
  { icon: Shield, text: "Redução de erros operacionais" },
  { icon: BarChart3, text: "Mais controle e organização" },
  { icon: Clock, text: "Economia de tempo" },
  { icon: TrendingUp, text: "Aumento da produtividade" },
  { icon: Zap, text: "Crescimento com segurança" },
];

const faqs = [
  {
    q: "Funciona com Mercado Livre Full?",
    a: "Sim! O sistema foi pensado especificamente para quem trabalha com estoque físico e Full. Você controla os dois estoques separadamente e faz envios com controle por bip.",
  },
  {
    q: "Preciso de leitor de código de barras?",
    a: "Recomendamos para melhor produtividade, mas não é obrigatório. O sistema funciona com leitura por câmera do celular também.",
  },
  {
    q: "Consigo importar minhas notas fiscais?",
    a: "Sim! Basta importar o XML da nota fiscal e o sistema atualiza automaticamente seu estoque, cadastro de produtos e fornecedores.",
  },
  {
    q: "Serve para operação pequena ou grande?",
    a: "O sistema escala com sua operação. Funciona tanto para quem vende 50 quanto para quem vende 5.000 produtos por mês.",
  },
  {
    q: "Preciso de conhecimento técnico?",
    a: "Não! A interface é simples e intuitiva. Se você sabe usar o Mercado Livre, sabe usar nosso sistema.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleCTA = () => navigate("/signup");

  return (
    <div className="min-h-screen bg-background">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5" />
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32 text-center">
          <Badge variant="secondary" className="mb-6 text-sm px-4 py-1.5">
            <Zap className="h-3.5 w-3.5 mr-1.5 inline" />
            Sistema ERP + Mercado Livre
          </Badge>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight max-w-4xl mx-auto">
            Controle total do seu estoque e vendas no Mercado Livre{" "}
            <span className="text-primary">— sem erros e sem planilhas</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Sistema completo com leitura por código de barras, integração automática
            e controle de estoque físico + Full
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleCTA} className="text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all">
              Quero automatizar minha operação
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 inline mr-1 text-accent" />
            Usado por vendedores que querem escalar com segurança
          </p>
        </div>
      </section>

      {/* DOR */}
      <section className="py-16 md:py-24 bg-card border-y border-border">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-4xl font-bold text-center text-foreground mb-4">
            Você se identifica com algum desses problemas?
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Se você ainda controla isso manualmente, está perdendo dinheiro todos os dias.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {painPoints.map((p, i) => (
              <Card key={i} className="border-destructive/20 bg-destructive/5">
                <CardContent className="flex items-center gap-3 p-5">
                  <p.icon className="h-6 w-6 text-destructive shrink-0" />
                  <span className="text-foreground font-medium">{p.text}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            A solução
          </Badge>
          <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-4">
            Sistema ERP completo com integração total ao Mercado Livre
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Pensado para quem precisa de controle, velocidade e precisão na operação.
            Tudo num só lugar, sem complicação.
          </p>
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section className="py-16 md:py-24 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-4xl font-bold text-center text-foreground mb-12">
            Tudo que você precisa em um só sistema
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Card key={i} className="group hover:shadow-lg transition-all hover:border-primary/30">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-4">
            O resultado na sua operação
          </h2>
          <p className="text-muted-foreground mb-12 max-w-xl mx-auto text-lg">
            Você deixa de apagar incêndio e passa a ter controle total da operação.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {benefits.map((b, i) => (
              <div key={i} className="flex flex-col items-center gap-3 p-6 rounded-xl bg-accent/10 border border-accent/20">
                <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <b.icon className="h-5 w-5 text-accent" />
                </div>
                <span className="text-sm font-medium text-foreground text-center">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROVA / AUTORIDADE */}
      <section className="py-16 md:py-24 bg-card border-y border-border">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl p-8 md:p-12 border border-primary/10">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Desenvolvido com base na operação real de vendedores
            </h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Pensado para quem realmente vende no dia a dia. Cada funcionalidade
              foi criada para resolver problemas reais de quem opera no Mercado Livre.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl md:text-4xl font-bold text-center text-foreground mb-12">
            Perguntas frequentes
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <Card
                key={i}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-foreground">{faq.q}</h3>
                    {openFaq === i ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  {openFaq === i && (
                    <p className="mt-3 text-muted-foreground text-sm leading-relaxed">{faq.a}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 via-background to-accent/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-4">
            Comece agora a organizar sua operação
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Pare de perder dinheiro com erros e processos manuais.
            Automatize sua operação hoje.
          </p>
          <Button size="lg" onClick={handleCTA} className="text-lg px-10 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all">
            Quero testar o sistema
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Cadastro rápido • Sem cartão de crédito • Suporte incluso
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ERP Mercado Livre — Todos os direitos reservados
        </div>
      </footer>
    </div>
  );
}
