import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
                      <Route path="/movimentacao-full" element={<MovimentacaoFull />} />
                      <Route path="/integracao-ml" element={<IntegracaoML />} />
                      <Route path="/pdv" element={<PDV />} />
                      <Route path="/crm" element={<CRM />} />
                      <Route path="/painel-hub" element={<PainelHub />} />
                      <Route path="/financeiro" element={<Financeiro />} />
                      <Route path="/admin" element={<AdminPanel />} />
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
