import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package, ScanBarcode, BarChart3, Truck, RefreshCw,
  DollarSign, ClipboardList, Monitor, Users, ArrowRight,
  CheckCircle2, XCircle, ChevronDown, Zap,
  Shield, Clock, TrendingUp, AlertTriangle, Check, Star, Rocket, Crown,
  Quote, MessageSquare, MessageCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const painPoints = [
  { icon: XCircle, text: "Produto vendido sem ter em estoque" },
  { icon: AlertTriangle, text: "Confusão entre estoque físico e FULL" },
  { icon: RefreshCw, text: "Erro na conferência de mercadoria" },
  { icon: Clock, text: "Tempo perdido em processos manuais" },
  { icon: DollarSign, text: "Problemas com notas fiscais" },
];

const features = [
  { icon: Package, title: "📦 Importação automática de notas (XML)", desc: "Cadastre produtos e atualize o estoque automaticamente, sem digitar nada." },
  { icon: ScanBarcode, title: "📡 Conferência com leitor de código de barras", desc: "Evite erros humanos e garanta que o produto recebido está correto." },
  { icon: BarChart3, title: "📊 Controle de estoque físico e FULL", desc: "Separe corretamente seus estoques e evite vender produto indisponível." },
  { icon: Truck, title: "🚚 Envio para FULL com controle por bip", desc: "Faça a separação com agilidade e segurança, sem erro de envio." },
  { icon: RefreshCw, title: "🔄 Integração automática com Mercado Livre", desc: "Toda venda atualiza o estoque automaticamente." },
  { icon: DollarSign, title: "💰 Controle de custo e lucro", desc: "Saiba exatamente quanto você ganha em cada produto." },
  { icon: ClipboardList, title: "🧾 Cadastro inteligente de produtos", desc: "Mesmo produto com vários fornecedores, sem conflito de código de barras." },
  { icon: Monitor, title: "🛒 PDV integrado", desc: "Venda direta com leitor de código de barras e baixa automática no estoque." },
  { icon: Users, title: "👥 Controle de clientes (CRM)", desc: "Tenha histórico completo de compras e pedidos." },
];

const benefits = [
  { icon: Shield, text: "Menos erros e prejuízo" },
  { icon: BarChart3, text: "Mais controle e organização" },
  { icon: Clock, text: "Economia de tempo" },
  { icon: TrendingUp, text: "Processo mais rápido" },
  { icon: Zap, text: "Crescimento com segurança" },
];

const testimonials = [
  {
    name: "Ricardo M.",
    role: "Vendedor Mercado Livre — 2.000+ vendas/mês",
    text: "Antes eu perdia horas conferindo mercadoria na mão. Com o sistema, faço tudo com bip em minutos. Reduzi erros em 90% e minha equipe ficou muito mais produtiva.",
    highlight: "Reduzi erros em 90%",
  },
  {
    name: "Camila S.",
    role: "Loja de eletrônicos — Full + Físico",
    text: "A confusão entre estoque físico e Full acabou. Agora sei exatamente o que tenho em cada lugar e as vendas nunca mais cancelaram por falta de estoque.",
    highlight: "Vendas nunca mais cancelaram",
  },
  {
    name: "André L.",
    role: "Vendedor desde 2019 — MercadoLíder",
    text: "O XML da nota fiscal entra e já atualiza tudo automaticamente. Economizo pelo menos 3 horas por dia que eu gastava em planilhas. Melhor investimento que fiz.",
    highlight: "Economizo 3 horas por dia",
  },
];

const plans = [
  {
    name: "Básico",
    price: "97",
    desc: "Para quem está começando",
    icon: Star,
    highlight: false,
    color: "green",
    features: [
      "Cadastro de produtos",
      "Importação de XML",
      "Controle de estoque físico",
      "PDV básico",
      "1 usuário",
    ],
    cta: "Começar agora",
  },
  {
    name: "Profissional",
    price: "147",
    desc: "Para quem vende no Mercado Livre e quer escalar",
    subdesc: "Perfeito para quem quer crescer sem perder controle",
    icon: Crown,
    highlight: true,
    color: "yellow",
    badge: "🔥 Mais escolhido",
    features: [
      "Tudo do plano básico",
      "Integração com Mercado Livre",
      "Baixa automática de vendas",
      "Controle de estoque FULL",
      "Envio para FULL com bip",
      "Conferência por código de barras",
      "Custo médio e lucro",
      "Até 3 usuários",
    ],
    cta: "Quero automatizar tudo",
  },
  {
    name: "Avançado",
    price: "247",
    desc: "Para operações maiores",
    icon: Rocket,
    highlight: false,
    color: "blue",
    features: [
      "Tudo do plano profissional",
      "Usuários ilimitados",
      "Relatórios avançados",
      "Dashboard completo",
      "Suporte prioritário",
    ],
    cta: "Falar com especialista",
  },
];

const faqs = [
  { q: "Funciona com Mercado Livre Full?", a: "Sim, o sistema separa estoque físico e FULL automaticamente." },
  { q: "Preciso de leitor de código de barras?", a: "Recomendado para máxima eficiência, mas não obrigatório." },
  { q: "Consigo importar minhas notas fiscais?", a: "Sim, via XML de forma automática." },
  { q: "Serve para empresa pequena?", a: "Sim, desde quem está começando até operações maiores." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0, 0, 0.2, 1] as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, delay: i * 0.08, ease: [0, 0, 0.2, 1] as const },
  }),
};

const WHATSAPP_URL = "https://wa.me/5511999999999?text=Ol%C3%A1!%20Quero%20saber%20mais%20sobre%20o%20sistema%20ERP";

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleCTA = () => navigate("/signup");

  return (
    <div className="min-h-screen bg-background">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5" />
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="relative max-w-6xl mx-auto px-4 py-20 md:py-32 text-center"
        >
          <motion.div variants={fadeUp} custom={0}>
            <Badge variant="secondary" className="mb-6 text-sm px-4 py-1.5">
              <Zap className="h-3.5 w-3.5 mr-1.5 inline" />
              Sistema ERP + Mercado Livre
            </Badge>
          </motion.div>
          <motion.h1
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight max-w-4xl mx-auto"
          >
            Pare de perder dinheiro com erro de estoque no{" "}
            <span className="text-primary">Mercado Livre</span>
          </motion.h1>
          <motion.p
            variants={fadeUp}
            custom={2}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Controle total do seu estoque físico e FULL com leitura por código de barras, importação automática de notas e integração em tempo real.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleCTA} className="text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all">
              👉 Quero automatizar minha operação
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
          <motion.p variants={fadeUp} custom={4} className="mt-4 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 inline mr-1 text-accent" />
            Desenvolvido para quem vende de verdade no dia a dia
          </motion.p>
        </motion.div>
      </section>

      {/* DOR */}
      <section className="py-16 md:py-24 bg-card border-y border-border">
        <div className="max-w-5xl mx-auto px-4">
          <motion.h2
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            className="text-2xl md:text-4xl font-bold text-center text-foreground mb-4"
          >
            🔴 Você está passando por isso hoje?
          </motion.h2>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10"
          >
            {painPoints.map((p, i) => (
              <motion.div key={i} variants={scaleIn} custom={i}>
                <Card className="border-destructive/20 bg-destructive/5 hover:scale-[1.03] transition-transform">
                  <CardContent className="flex items-center gap-3 p-5">
                    <p.icon className="h-6 w-6 text-destructive shrink-0" />
                    <span className="text-foreground font-medium">{p.text}</span>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
          <motion.p
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={1}
            className="text-center text-muted-foreground mt-10 text-lg font-semibold"
          >
            👉 Se você ainda controla isso manualmente, está perdendo dinheiro todos os dias.
          </motion.p>
        </div>
      </section>

      {/* SOLUÇÃO */}
      <section className="py-16 md:py-24">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
          className="max-w-5xl mx-auto px-4 text-center"
        >
          <motion.div variants={fadeUp}>
            <Badge variant="outline" className="mb-4 text-primary border-primary/30">🟢 A solução</Badge>
          </motion.div>
          <motion.h2 variants={fadeUp} custom={1} className="text-2xl md:text-4xl font-bold text-foreground mb-4">
            Um sistema completo para eliminar erros e organizar sua operação
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Sistema ERP integrado ao Mercado Livre que automatiza processos, reduz falhas e te dá controle total do estoque e das vendas.
          </motion.p>
        </motion.div>
      </section>

      {/* FUNCIONALIDADES */}
      <section className="py-16 md:py-24 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-4">
          <motion.h2
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp}
            className="text-2xl md:text-4xl font-bold text-center text-foreground mb-4"
          >
            ⚙️ Funcionalidades com foco em benefício
          </motion.h2>
          <motion.p
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={1}
            className="text-center text-muted-foreground mb-12 max-w-xl mx-auto"
          >
            Cada recurso foi pensado para resolver um problema real da sua operação.
          </motion.p>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((f, i) => (
              <motion.div key={i} variants={scaleIn} custom={i}>
                <Card className="group hover:shadow-lg transition-all hover:border-primary/30 h-full">
                  <CardContent className="p-6">
                    <motion.div
                      whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.4 } }}
                      className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors"
                    >
                      <f.icon className="h-6 w-6 text-primary" />
                    </motion.div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <motion.h2
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp}
            className="text-2xl md:text-4xl font-bold text-foreground mb-4"
          >
            🔵 O que muda na sua operação
          </motion.h2>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-10"
          >
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                variants={scaleIn}
                custom={i}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-accent/10 border border-accent/20"
              >
                <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <b.icon className="h-5 w-5 text-accent" />
                </div>
                <span className="text-sm font-medium text-foreground text-center">{b.text}</span>
              </motion.div>
            ))}
          </motion.div>
          <motion.p
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={1}
            className="text-muted-foreground mt-10 text-lg font-semibold"
          >
            👉 Você sai do caos operacional e passa a ter controle total do seu negócio.
          </motion.p>
        </div>
      </section>

      {/* PREÇOS */}
      <section className="py-16 md:py-24 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className="text-center mb-12"
          >
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="mb-4 text-primary border-primary/30">💰 Planos</Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-2xl md:text-4xl font-bold text-foreground mb-4">
              Escolha o plano ideal para sua operação
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch"
          >
            {plans.map((plan, i) => (
              <motion.div key={i} variants={scaleIn} custom={i} className="flex">
                <Card
                  className={`flex flex-col w-full relative transition-all ${
                    plan.highlight
                      ? "border-primary border-2 shadow-xl scale-[1.02] md:scale-105"
                      : "hover:border-primary/30 hover:shadow-lg"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold shadow-md">
                        {plan.badge}
                      </Badge>
                    </div>
                  )}
                  <CardContent className="flex flex-col flex-1 p-6 pt-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                        plan.highlight ? "bg-primary/20" : "bg-muted"
                      }`}>
                        <plan.icon className={`h-5 w-5 ${plan.highlight ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                    </div>

                    <div className="mb-4">
                      <span className="text-4xl font-extrabold text-foreground">R$ {plan.price}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">{plan.desc}</p>
                    {plan.subdesc && (
                      <p className="text-xs text-primary font-medium mb-4">👉 {plan.subdesc}</p>
                    )}

                    <ul className="space-y-3 mb-8 flex-1">
                      {plan.features.map((feat, fi) => (
                        <li key={fi} className="flex items-start gap-2 text-sm text-foreground">
                          <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.highlight ? "text-primary" : "text-accent"}`} />
                          {feat}
                        </li>
                      ))}
                    </ul>

                    <Button
                      size="lg"
                      onClick={handleCTA}
                      variant={plan.highlight ? "default" : "outline"}
                      className={`w-full rounded-xl ${plan.highlight ? "shadow-lg" : ""}`}
                    >
                      {plan.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Implantação */}
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }}
            variants={fadeUp}
            className="mt-12 text-center"
          >
            <Card className="inline-block border-primary/20 bg-primary/5">
              <CardContent className="p-6 flex items-center gap-4 flex-col sm:flex-row">
                <Zap className="h-8 w-8 text-primary shrink-0" />
                <div className="text-left">
                  <p className="font-semibold text-foreground">💡 Implantação assistida disponível</p>
                  <p className="text-sm text-muted-foreground">Configuração completa do sistema para você começar com tudo funcionando.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className="text-center mb-12"
          >
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="mb-4 text-primary border-primary/30">
                <MessageSquare className="h-3.5 w-3.5 mr-1.5 inline" />
                Depoimentos
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-2xl md:text-4xl font-bold text-foreground mb-4">
              Quem usa, recomenda
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {testimonials.map((t, i) => (
              <motion.div key={i} variants={scaleIn} custom={i}>
                <Card className="h-full hover:shadow-lg transition-all hover:border-primary/30">
                  <CardContent className="p-6 flex flex-col h-full">
                    <Quote className="h-8 w-8 text-primary/30 mb-4" />
                    <p className="text-muted-foreground text-sm leading-relaxed flex-1 mb-4">
                      "{t.text}"
                    </p>
                    <div className="mb-4">
                      <Badge variant="secondary" className="text-xs">
                        {t.highlight}
                      </Badge>
                    </div>
                    <div className="border-t border-border pt-4">
                      <p className="font-semibold text-foreground text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* PROVA / AUTORIDADE */}
      <section className="py-16 md:py-24 bg-card border-y border-border">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }}
            variants={fadeUp}
            className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl p-8 md:p-12 border border-primary/10"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            </motion.div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              🟣 Desenvolvido com base na operação real
            </h2>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Desenvolvido com base na operação real de vendedores que utilizam Mercado Livre diariamente.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 via-background to-accent/5">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }}
          variants={staggerContainer}
          className="max-w-3xl mx-auto px-4 text-center"
        >
          <motion.h2 variants={fadeUp} className="text-2xl md:text-4xl font-bold text-foreground mb-4">
            🟢 Comece agora a organizar sua operação
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-muted-foreground mb-8 text-lg">
            Pare de perder tempo e dinheiro com processos manuais.
          </motion.p>
          <motion.div variants={fadeUp} custom={2}>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button
                size="lg"
                className="text-lg px-10 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] text-primary-foreground"
              >
                <MessageCircle className="mr-2 h-6 w-6" />
                Falar no WhatsApp agora
              </Button>
            </a>
          </motion.div>
          <motion.p variants={fadeUp} custom={3} className="mt-4 text-sm text-muted-foreground">
            Cadastro rápido • Sem cartão de crédito • Suporte incluso
          </motion.p>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-card border-y border-border">
        <div className="max-w-3xl mx-auto px-4">
          <motion.h2
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp}
            className="text-2xl md:text-4xl font-bold text-center text-foreground mb-12"
          >
            ❓ Perguntas frequentes
          </motion.h2>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
            className="space-y-3"
          >
            {faqs.map((faq, i) => (
              <motion.div key={i} variants={fadeUp} custom={i}>
                <Card
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-semibold text-foreground">{faq.q}</h3>
                      <motion.div
                        animate={{ rotate: openFaq === i ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                      </motion.div>
                    </div>
                    <AnimatePresence>
                      {openFaq === i && (
                        <motion.p
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="mt-3 text-muted-foreground text-sm leading-relaxed overflow-hidden"
                        >
                          {faq.a}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 border-t border-border">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ERP Mercado Livre — Todos os direitos reservados
        </div>
      </footer>

      {/* BOTÃO WHATSAPP FIXO */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] text-primary-foreground flex items-center justify-center shadow-xl hover:scale-110 transition-all"
        aria-label="Falar no WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
}
