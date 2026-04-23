import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GravacoesFullTab } from "@/components/GravacoesFullTab";
import { OrdensFullTab } from "@/components/OrdensFullTab";

const MovimentacaoFull = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Movimentação Físico → FULL</h1>
        <p className="text-muted-foreground">Envie produtos do estoque físico para o FULL Mercado Livre</p>
      </div>

      <Tabs defaultValue="ordens" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ordens">📋 Ordens</TabsTrigger>
          <TabsTrigger value="gravacoes">🎥 Gravações</TabsTrigger>
        </TabsList>

        <TabsContent value="ordens" className="mt-0">
          <OrdensFullTab />
        </TabsContent>

        <TabsContent value="gravacoes" className="mt-0">
          <GravacoesFullTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MovimentacaoFull;
