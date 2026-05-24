import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImportJobRow, ColumnMapping } from "../types/import-types";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  rows: Partial<ImportJobRow>[];
  mappings: ColumnMapping[];
}

export const ImportPreviewTable = ({ rows, mappings }: Props) => {
  return (
    <div className="rounded-md border">
      <ScrollArea className="h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Status</TableHead>
              {mappings.map(m => (
                <TableHead key={m.internalField}>{m.internalField}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 50).map((row, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  {row.validation_errors && row.validation_errors.length > 0 ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </TableCell>
                {mappings.map(m => (
                  <TableCell key={m.internalField}>
                    {String(row.mapped_data?.[m.internalField] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      {rows.length > 50 && (
        <p className="text-xs text-center py-2 text-muted-foreground">
          Mostrando as primeiras 50 de {rows.length} linhas.
        </p>
      )}
    </div>
  );
};
