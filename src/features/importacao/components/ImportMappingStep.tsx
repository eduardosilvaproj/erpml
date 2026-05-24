import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ColumnMapping, MAPPABLE_FIELDS } from "../types/import-types";

interface Props {
  headers: string[];
  mappings: ColumnMapping[];
  onUpdateMapping: (internal: string, external: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const ImportMappingStep = ({ headers, mappings, onUpdateMapping, onNext, onBack }: Props) => {
  return (
    <div className="space-y-6">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campo do Sistema</TableHead>
              <TableHead>Coluna no Arquivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MAPPABLE_FIELDS.map((field) => (
              <TableRow key={field.value}>
                <TableCell className="font-medium">
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </TableCell>
                <TableCell>
                  <Select 
                    value={mappings.find(m => m.internalField === field.value)?.externalField || "__none__"}
                    onValueChange={(val) => onUpdateMapping(field.value, val === "__none__" ? "" : val)}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder="Selecione uma coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">(Não mapear)</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={onNext}>Validar Dados</Button>
      </div>
    </div>
  );
};
