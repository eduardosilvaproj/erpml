import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Users, 
  CreditCard, 
  Power, 
  DollarSign, 
  Settings, 
  Loader2,
  PieChart,
  ShieldCheck
} from "lucide-react";
import { useHasAdminAccess } from "@/hooks/useAdminData";
import { Navigate } from "react-router-dom";

// Governance Panels
import { CompaniesPanel } from "@/components/admin-governance/CompaniesPanel";
import { UsersPanel } from "@/components/admin-governance/UsersPanel";
import { PlansPanel } from "@/components/admin-governance/PlansPanel";
import { BillingPanel } from "@/components/admin-governance/BillingPanel";
import { ActivationPanel } from "@/components/admin-governance/ActivationPanel";
import { FinanceDashboard } from "@/components/admin-governance/FinanceDashboard";
import PendingUsersTab from "@/components/PendingUsersTab";
import SystemResetCard from "@/components/SystemResetCard";

export default function MasterAdmin() {
  const { hasPlatformAdminAccess, isLoading } = useHasAdminAccess();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Permite acesso se tiver qualquer nível de admin de plataforma
  if (!hasPlatformAdminAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-amber-500" />
          Painel Master Stovix
        </h1>
        <p className="text-muted-foreground">
          Governança completa do ecossistema SaaS: empresas, usuários, planos e faturamento.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto p-1 bg-muted/50 border">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            <span className="hidden sm:inline">Financeiro</span>
          </TabsTrigger>
          <TabsTrigger value="empresas" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Empresas</span>
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="pendentes" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Pendentes</span>
          </TabsTrigger>
          <TabsTrigger value="planos" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Planos</span>
          </TabsTrigger>
          <TabsTrigger value="cobrancas" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Cobranças</span>
          </TabsTrigger>
          <TabsTrigger value="ativacao" className="flex items-center gap-2">
            <Power className="h-4 w-4" />
            <span className="hidden sm:inline">Ciclo de Vida</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Sistema</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <FinanceDashboard />
        </TabsContent>

        <TabsContent value="empresas">
          <CompaniesPanel />
        </TabsContent>

        <TabsContent value="usuarios">
          <UsersPanel />
        </TabsContent>

        <TabsContent value="pendentes">
          <PendingUsersTab />
        </TabsContent>

        <TabsContent value="planos">
          <PlansPanel />
        </TabsContent>

        <TabsContent value="cobrancas">
          <BillingPanel />
        </TabsContent>

        <TabsContent value="ativacao">
          <ActivationPanel />
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <SystemResetCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
