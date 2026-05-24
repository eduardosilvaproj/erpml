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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Nota fiscal importada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao importar nota", description: error.message, variant: "destructive" });
    },
  });
}
