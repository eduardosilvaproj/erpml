import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Undo2, Plus } from "lucide-react";
import { ReturnsListTab } from "@/components/devolucoes/ReturnsListTab";
import { QuarantinePanel } from "@/components/devolucoes/QuarantinePanel";
import { ReturnForm } from "@/components/devolucoes/ReturnForm";

export default function Devolucoes() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Undo2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Devoluções e Retiradas</h1>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova devolução
        </Button>
      </div>

      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="conferencia">Em Conferência</TabsTrigger>
          <TabsTrigger value="decisao">Aguardando Decisão</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
          <TabsTrigger value="quarentena">Quarentena</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes" className="mt-4"><ReturnsListTab status="pendente" /></TabsContent>
        <TabsContent value="conferencia" className="mt-4"><ReturnsListTab status="em_conferencia" /></TabsContent>
        <TabsContent value="decisao" className="mt-4"><ReturnsListTab status="aguardando_decisao" /></TabsContent>
        <TabsContent value="concluidas" className="mt-4"><ReturnsListTab status="concluida" /></TabsContent>
        <TabsContent value="quarentena" className="mt-4"><QuarantinePanel /></TabsContent>
      </Tabs>

      <ReturnForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
