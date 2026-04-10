import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlanProtectedRoute } from "@/components/PlanProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Produtos from "./pages/Produtos";
import EntradaXML from "./pages/EntradaXML";
import Conferencia from "./pages/Conferencia";
import Estoque from "./pages/Estoque";
import MovimentacaoFull from "./pages/MovimentacaoFull";
import IntegracaoML from "./pages/IntegracaoML";
import PDV from "./pages/PDV";
import CRM from "./pages/CRM";
import PainelHub from "./pages/PainelHub";
import AdminPanel from "./pages/AdminPanel";
import Financeiro from "./pages/Financeiro";
import IAConsulta from "./pages/IAConsulta";
import IAHub from "./pages/IAHub";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import CompanyDashboard from "./pages/CompanyDashboard";
import Onboarding from "./pages/Onboarding";
import MasterAdmin from "./pages/MasterAdmin";
import Upgrade from "./pages/Upgrade";
import Equipe from "./pages/Equipe";
import BoasVindas from "./pages/BoasVindas";
import Campanhas from "./pages/Campanhas";
import PesquisaInteligente from "./pages/PesquisaInteligente";
import AnaliseConcorrencia from "./pages/AnaliseConcorrencia";
import PrevisaoDemanda from "./pages/PrevisaoDemanda";
import PrecoDinamico from "./pages/PrecoDinamico";
import GeradorDescricoes from "./pages/GeradorDescricoes";
import AnaliseRentabilidade from "./pages/AnaliseRentabilidade";
import OtimizadorTitulos from "./pages/OtimizadorTitulos";
import RespostaPerguntas from "./pages/RespostaPerguntas";
import ChatIA from "./pages/ChatIA";
import AnaliseMercado from "./pages/AnaliseMercado";
import GeradorEAN13 from "./pages/GeradorEAN13";
import Kits from "./pages/Kits";
import MentorVendasML from "./pages/MentorVendasML";
import BalancoEstoque from "./pages/BalancoEstoque";
import EntradaNota from "./pages/EntradaNota";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s — avoid refetches on every navigation
      gcTime: 5 * 60 * 1000,    // 5min — keep unused cache before GC
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/upgrade" element={<Upgrade />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/produtos" element={<Produtos />} />
                      <Route path="/entrada-xml" element={<EntradaXML />} />
                      <Route path="/entrada-nota" element={<EntradaNota />} />
                      <Route path="/conferencia" element={<Conferencia />} />
                      <Route path="/estoque" element={<Estoque />} />
                      <Route path="/balanco-estoque" element={<BalancoEstoque />} />
                      <Route path="/movimentacao-full" element={<PlanProtectedRoute path="/movimentacao-full"><MovimentacaoFull /></PlanProtectedRoute>} />
                      <Route path="/kits" element={<Kits />} />
                      <Route path="/integracao-ml" element={<PlanProtectedRoute path="/integracao-ml"><IntegracaoML /></PlanProtectedRoute>} />
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
                      <Route path="/admin" element={<AdminPanel />} />
                      <Route path="/mentor-vendas" element={<PlanProtectedRoute path="/mentor-vendas"><MentorVendasML /></PlanProtectedRoute>} />
                      <Route path="/empresa" element={<CompanyDashboard />} />
                      <Route path="/equipe" element={<Equipe />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/master-admin" element={<MasterAdmin />} />
                      
                      <Route path="/boas-vindas" element={<BoasVindas />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
