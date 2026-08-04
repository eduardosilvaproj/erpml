import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMyCompany } from "@/hooks/useCompanyData";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Rocket,
  Package,
  Users,
  FileText,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const steps = [
  {
    icon: Package,
    title: "Cadastrar Produtos",
    description: "Adicione seus produtos com SKU, preço e estoque para começar a vender.",
    path: "/produtos",
    cta: "Ir para Produtos",
  },
  {
    icon: FileText,
    title: "Importar Notas Fiscais",
    description: "Importe XML de notas fiscais para atualizar seu estoque automaticamente.",
    path: "/entrada-nota",
    cta: "Importar Nota",
  },
  {
    icon: Users,
    title: "Convidar Equipe",
    description: "Adicione membros da sua equipe para colaborar na gestão.",
    path: "/equipe",
    cta: "Gerenciar Equipe",
  },
  {
    icon: BarChart3,
    title: "Explorar o Painel",
    description: "Acompanhe vendas, estoque e métricas em tempo real.",
    path: "/painel-hub",
    cta: "Ver Painel",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.4 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function BoasVindas() {
  const navigate = useNavigate();
  const { data: company } = useMyCompany();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Animated background elements */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: `hsl(${220 + i * 20}, 70%, ${55 + i * 3}%)`,
                left: `${10 + Math.random() * 80}%`,
                top: `-5%`,
              }}
              animate={{
                y: ["0vh", "100vh"],
                rotate: [0, 360],
                opacity: [1, 0],
              }}
              transition={{
                duration: 2.5 + Math.random() * 2,
                delay: Math.random() * 1.5,
                ease: "easeIn",
              }}
            />
          ))}
        </div>
      )}

      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center mb-10 max-w-2xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6"
        >
          <Rocket className="w-10 h-10 text-primary" />
        </motion.div>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          Bem-vindo ao BipStock! 🎉
        </h1>

        {company && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-full px-4 py-1.5 mb-4"
          >
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              {company.name} criada com sucesso
            </span>
          </motion.div>
        )}

        <p className="text-muted-foreground text-lg leading-relaxed">
          Sua empresa está pronta! Siga os passos abaixo para configurar
          tudo e começar a usar o sistema.
        </p>
      </motion.div>

      {/* Steps grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl w-full mb-10"
      >
        {steps.map((step, index) => (
          <motion.div key={step.title} variants={item}>
            <Card
              className="group cursor-pointer hover-lift border-border/60 hover:border-primary/30 transition-all duration-300"
              onClick={() => navigate(step.path)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Passo {index + 1}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">
                      {step.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-2 group-hover:gap-2 transition-all">
                      {step.cta}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="flex flex-col items-center gap-3"
      >
        <Button size="lg" onClick={() => navigate("/")} className="gap-2">
          <Sparkles className="w-4 h-4" />
          Ir para o Dashboard
        </Button>
        <button
          onClick={() => navigate("/empresa")}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Completar dados da empresa →
        </button>
      </motion.div>
    </div>
  );
}
