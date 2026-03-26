import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
