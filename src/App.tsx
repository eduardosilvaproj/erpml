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

const queryClient = new QueryClient();

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
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/produtos" element={<Produtos />} />
                      <Route path="/entrada-xml" element={<EntradaXML />} />
                      <Route path="/conferencia" element={<Conferencia />} />
                      <Route path="/estoque" element={<Estoque />} />
                      <Route path="/movimentacao-full" element={<PlanProtectedRoute path="/movimentacao-full"><MovimentacaoFull /></PlanProtectedRoute>} />
                      <Route path="/integracao-ml" element={<PlanProtectedRoute path="/integracao-ml"><IntegracaoML /></PlanProtectedRoute>} />
                      <Route path="/pdv" element={<PDV />} />
                      <Route path="/crm" element={<CRM />} />
                      <Route path="/painel-hub" element={<PlanProtectedRoute path="/painel-hub"><PainelHub /></PlanProtectedRoute>} />
                      <Route path="/financeiro" element={<PlanProtectedRoute path="/financeiro"><Financeiro /></PlanProtectedRoute>} />
                      <Route path="/ia-consulta" element={<PlanProtectedRoute path="/ia-consulta"><IAConsulta /></PlanProtectedRoute>} />
                      <Route path="/admin" element={<AdminPanel />} />
                      <Route path="/empresa" element={<CompanyDashboard />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/master-admin" element={<MasterAdmin />} />
                      <Route path="/upgrade" element={<Upgrade />} />
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
