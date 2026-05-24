import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { HelpProvider } from "@/contexts/HelpContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuditProvider } from "@/contexts/AuditContext";
import { VersionUpdateBanner } from "@/components/VersionUpdateBanner";
import { UpdateRequiredModal } from "@/components/UpdateRequiredModal";
import { isVersionOutdated } from "@/config/version";
import { PlanProtectedRoute } from "@/components/PlanProtectedRoute";
import { AdminMasterDevGuard } from "@/components/AdminMasterDevGuard";
// Removed AdminGovernanceGuard as it's no longer used due to consolidation into /master-admin

import AppLayout from "@/components/AppLayout";
import LoadingScreen from "@/components/LoadingScreen";

// Lazy loading components
const Index = lazy(() => import("./pages/Index"));
const Produtos = lazy(() => import("./pages/Produtos"));
const CorrecaoSKU = lazy(() => import("./pages/CorrecaoSKU"));
const EntradaXML = lazy(() => import("./pages/EntradaXML"));
const EntradaNota = lazy(() => import("./pages/EntradaNota"));
const Conferencia = lazy(() => import("./pages/Conferencia"));
const Separacao = lazy(() => import("./pages/Separacao"));
const RecuperarConferencia = lazy(() => import("./pages/RecuperarConferencia"));
const Estoque = lazy(() => import("./pages/Estoque"));
const MovimentacaoFull = lazy(() => import("./pages/MovimentacaoFull"));
const IntegracaoML = lazy(() => import("./pages/IntegracaoML"));
const PDV = lazy(() => import("./pages/PDV"));
const CRM = lazy(() => import("./pages/CRM"));
const PainelHub = lazy(() => import("./pages/PainelHub"));
// Removed PainelControle and AdminPanel lazy loads as they are now redirected to MasterAdmin
const Financeiro = lazy(() => import("./pages/Financeiro"));
const IAConsulta = lazy(() => import("./pages/IAConsulta"));
const IAHub = lazy(() => import("./pages/IAHub"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CompanyDashboard = lazy(() => import("./pages/CompanyDashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const MasterAdmin = lazy(() => import("./pages/MasterAdmin"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const Equipe = lazy(() => import("./pages/Equipe"));
const BoasVindas = lazy(() => import("./pages/BoasVindas"));
const Campanhas = lazy(() => import("./pages/Campanhas"));
const PesquisaInteligente = lazy(() => import("./pages/PesquisaInteligente"));
const AnaliseConcorrencia = lazy(() => import("./pages/AnaliseConcorrencia"));
const PrevisaoDemanda = lazy(() => import("./pages/PrevisaoDemanda"));
const PrecoDinamico = lazy(() => import("./pages/PrecoDinamico"));
const GeradorDescricoes = lazy(() => import("./pages/GeradorDescricoes"));
const AnaliseRentabilidade = lazy(() => import("./pages/AnaliseRentabilidade"));
const OtimizadorTitulos = lazy(() => import("./pages/OtimizadorTitulos"));
const RespostaPerguntas = lazy(() => import("./pages/RespostaPerguntas"));
const ChatIA = lazy(() => import("./pages/ChatIA"));
const AnaliseMercado = lazy(() => import("./pages/AnaliseMercado"));
const GeradorEAN13 = lazy(() => import("./pages/GeradorEAN13"));
const Kits = lazy(() => import("./pages/Kits"));
const MentorVendasML = lazy(() => import("./pages/MentorVendasML"));
const BalancoEstoque = lazy(() => import("./pages/BalancoEstoque"));
const MinhaLojaConfig = lazy(() => import("./pages/MinhaLojaConfig"));
const MinhaLojaProdutos = lazy(() => import("./pages/MinhaLojaProdutos"));
const MinhaLojaPedidos = lazy(() => import("./pages/MinhaLojaPedidos"));
const LojaPublica = lazy(() => import("./pages/LojaPublica"));
const LojaCheckout = lazy(() => import("./pages/LojaCheckout"));
const DuplicadorAnuncios = lazy(() => import("./pages/DuplicadorAnuncios"));
const AdminMasterDev = lazy(() => import("./pages/AdminMasterDev"));
// Removed AdminGovernance lazy load as it's now redirected to MasterAdmin
const Importacao = lazy(() => import("./pages/Importacao"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = (): JSX.Element => {
  if (isVersionOutdated()) {
    return <UpdateRequiredModal />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={500}>
        <Toaster />
        <Sonner />
        <VersionUpdateBanner />
        <BrowserRouter>
          <AuthProvider>
            <AuditProvider>
              <HelpProvider>
                <Routes>
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/upgrade" element={<Upgrade />} />
                  <Route path="/loja/:slug" element={<LojaPublica />} />
                  <Route path="/loja/:slug/checkout" element={<LojaCheckout />} />
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Suspense fallback={<LoadingScreen />}>
                            <Routes>
                              <Route path="/" element={<Index />} />
                              <Route path="/companies" element={<CompanyDashboard />} />
                              <Route path="/companies/:id" element={<CompanyDashboard />} />
                              <Route path="/plans" element={<Upgrade />} />
                              <Route path="/subscriptions" element={<Financeiro />} />
                              <Route path="/produtos" element={<Produtos />} />
                              <Route path="/produtos/correcao" element={<CorrecaoSKU />} />
                              <Route path="/entrada-xml" element={<EntradaXML />} />
                              <Route path="/entrada-nota" element={<EntradaNota />} />
                              <Route path="/conferencia" element={<Conferencia />} />
                              <Route path="/conferencia/recuperar" element={<RecuperarConferencia />} />
                              <Route path="/separacao" element={<Separacao />} />
                              <Route path="/estoque" element={<Estoque />} />
                              <Route path="/balanco-estoque" element={<BalancoEstoque />} />
                              <Route path="/movimentacao-full" element={<PlanProtectedRoute path="/movimentacao-full"><MovimentacaoFull /></PlanProtectedRoute>} />
                              <Route path="/kits" element={<Kits />} />
                              <Route path="/integracao-ml" element={<PlanProtectedRoute path="/integracao-ml"><IntegracaoML /></PlanProtectedRoute>} />
                              <Route path="/duplicador-anuncios" element={<PlanProtectedRoute path="/integracao-ml"><DuplicadorAnuncios /></PlanProtectedRoute>} />
                              <Route path="/campanhas" element={<PlanProtectedRoute path="/campanhas"><Campanhas /></PlanProtectedRoute>} />
                              <Route path="/pdv" element={<PDV />} />
                              <Route path="/crm" element={<CRM />} />
                              <Route path="/painel-hub" element={<PlanProtectedRoute path="/painel-hub"><PainelHub /></PlanProtectedRoute>} />
                              <Route path="/financeiro" element={<PlanProtectedRoute path="/financeiro"><Financeiro /></PlanProtectedRoute>} />
                              <Route path="/ia-consulta" element={<PlanProtectedRoute path="/ia-consulta"><IAConsulta /></PlanProtectedRoute>} />
                              <Route path="/ia-hub" element={<IAHub />} />
                              <Route path="/ia-concorrencia" element={<PlanProtectedRoute path="/ia-concorrencia"><AnaliseConcorrencia /></PlanProtectedRoute>} />
                              <Route path="/ia-demanda" element={<PlanProtectedRoute path="/ia-demanda"><PrevisaoDemanda /></PlanProtectedRoute>} />
                              <Route path="/ia-preco" element={<PlanProtectedRoute path="/ia-preco"><PrecoDinamico /></PlanProtectedRoute>} />
                              <Route path="/ia-descricoes" element={<GeradorDescricoes />} />
                              <Route path="/ia-rentabilidade" element={<PlanProtectedRoute path="/ia-rentabilidade"><AnaliseRentabilidade /></PlanProtectedRoute>} />
                              <Route path="/ia-titulos" element={<OtimizadorTitulos />} />
                              <Route path="/ia-respostas" element={<RespostaPerguntas />} />
                              <Route path="/ia-chat" element={<PlanProtectedRoute path="/ia-chat"><ChatIA /></PlanProtectedRoute>} />
                              <Route path="/ia-mercado" element={<PlanProtectedRoute path="/ia-mercado"><AnaliseMercado /></PlanProtectedRoute>} />
                              <Route path="/pesquisa" element={<PesquisaInteligente />} />
                              <Route path="/ia-ean13" element={<GeradorEAN13 />} />
                              <Route path="/importacao" element={<Importacao />} />
                              <Route path="/admin" element={<Navigate to="/master-admin" replace />} />
                              <Route path="/admin/painel-controle" element={<Navigate to="/master-admin" replace />} />
                              <Route path="/mentor-vendas" element={<PlanProtectedRoute path="/mentor-vendas"><MentorVendasML /></PlanProtectedRoute>} />
                              <Route path="/empresa" element={<CompanyDashboard />} />
                              <Route path="/equipe" element={<Equipe />} />
                              <Route path="/onboarding" element={<Onboarding />} />
                              <Route path="/master-admin" element={<MasterAdmin />} />
                              <Route path="/boas-vindas" element={<BoasVindas />} />
                              <Route path="/minha-loja/configurar" element={<MinhaLojaConfig />} />
                              <Route path="/minha-loja/produtos" element={<MinhaLojaProdutos />} />
                              <Route path="/minha-loja/pedidos" element={<MinhaLojaPedidos />} />
                              <Route path="/admin-master-dev" element={<AdminMasterDevGuard><AdminMasterDev /></AdminMasterDevGuard>} />
                              <Route path="/admin-master/*" element={<Navigate to="/master-admin" replace />} />
                              <Route path="/admin/painel-controle" element={<Navigate to="/master-admin" replace />} />
                              <Route path="/admin/*" element={<Navigate to="/master-admin" replace />} />

                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </Suspense>
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </HelpProvider>
            </AuditProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
