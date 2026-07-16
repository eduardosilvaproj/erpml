import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { invoicesService } from "@/services/invoices";
import type { MatchResult, NFeSupplier } from "@/lib/nfe-parser";

export function useInvoices() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["invoices", companyId],
    enabled: !!companyId,
    queryFn: () => invoicesService.fetchInvoices(companyId),
  });
}

export function useInvoiceStats() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["invoice-stats", companyId],
    enabled: !!companyId,
    queryFn: () => invoicesService.fetchInvoiceStats(companyId),
  });
}

export function useImportInvoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: (params: {
      nfeData: { 
        number: string; 
        series: string; 
        issuerName: string; 
        issuerCnpj: string; 
        totalValue: number;
        supplier?: NFeSupplier;
      };
      matches: MatchResult[];
      createNewProducts: boolean;
    }) => invoicesService.importInvoice({ ...params, companyId }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: result.pendingCount > 0 || result.skippedCount > 0
          ? "Nota importada com pendências de estoque"
          : "Nota importada e estoque atualizado",
        description: `${result.createdCount} produto(s) criado(s), ${result.updatedCount} atualizado(s)${result.pendingCount ? `, ${result.pendingCount} pendente(s)` : ""}${result.skippedCount ? `, ${result.skippedCount} ignorado(s)` : ""}.`,
        variant: result.pendingCount > 0 || result.skippedCount > 0 ? "default" : undefined,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao importar nota", description: error.message, variant: "destructive" });
    },
  });
}
