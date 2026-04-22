import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Produtos from "./pages/Produtos";
import EntradaXML from "./pages/EntradaXML";
import Conferencia from "./pages/Conferencia";
import RecuperarConferencia from "./pages/RecuperarConferencia";
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
import MinhaLojaConfig from "./pages/MinhaLojaConfig";
import MinhaLojaProdutos from "./pages/MinhaLojaProdutos";
import MinhaLojaPedidos from "./pages/MinhaLojaPedidos";
import LojaPublica from "./pages/LojaPublica";
import LojaCheckout from "./pages/LojaCheckout";
import DuplicadorAnuncios from "./pages/DuplicadorAnuncios";

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

const App = () => {
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
              ...
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
