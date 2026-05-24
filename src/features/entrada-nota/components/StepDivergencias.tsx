import React from "react";
import { CheckCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { type ConferenceItem } from "../types";

interface StepDivergenciasProps {
  divergences: ConferenceItem[];
  divergenceActions: Record<number, "conferida" | "nota">;
  setDivergenceActions: React.Dispatch<React.SetStateAction<Record<number, "conferida" | "nota">>>;
  setConferenceItems: React.Dispatch<React.SetStateAction<ConferenceItem[]>>;
  goToStep: (s: any) => void;
  setCurrentStep: (s: any) => void;
}

export const StepDivergencias = ({
  divergences, divergenceActions, setDivergenceActions, setConferenceItems, goToStep, setCurrentStep
}: StepDivergenciasProps) => {
  return (
    <div className="space-y-5">
      {divergences.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
            <p className="text-lg font-bold">Nenhuma divergência encontrada!</p>
            <p className="text-sm text-muted-foreground">Todos os itens conferem com a nota fiscal.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Qtd Nota</TableHead>
                <TableHead className="text-center">Qtd Conferida</TableHead>
                <TableHead className="text-center">Diferença</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divergences.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">{item.xmlProduct.description}</TableCell>
                  <TableCell className="text-center">{item.expectedQty}</TableCell>
                  <TableCell className="text-center">{item.scannedQty}</TableCell>
                  <TableCell className="text-center font-bold text-destructive">
                    {item.scannedQty - item.expectedQty}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant={divergenceActions[i] === "conferida" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDivergenceActions((p) => ({ ...p, [i]: "conferida" }))}
                      >
                        Aceitar conferida
                      </Button>
                      <Button
                        variant={divergenceActions[i] === "nota" ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setDivergenceActions((p) => ({ ...p, [i]: "nota" }));
                          setConferenceItems((prev) =>
                            prev.map((ci) =>
                              ci.xmlProduct.code === item.xmlProduct.code
                                ? { ...ci, scannedQty: ci.expectedQty, status: "ok" }
                                : ci
                            )
                          );
                        }}
                      >
                        Aceitar da nota
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setCurrentStep(2)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <Button onClick={() => goToStep(4)}>
          Próximo <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
