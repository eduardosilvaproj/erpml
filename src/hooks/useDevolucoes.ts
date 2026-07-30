import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { returnsService, ReturnStatus, ItemCondition, QuarantineStatus } from "@/services/returns";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";

export function useReturnsList(status?: ReturnStatus) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["returns", companyId, status ?? "all"],
    enabled: !!companyId,
    queryFn: () => returnsService.list(companyId!, status),
  });
}

export function useReturn(id: string | undefined) {
  return useQuery({
    queryKey: ["return", id],
    enabled: !!id,
    queryFn: () => returnsService.get(id!),
  });
}

export function useReturnItems(returnId: string | undefined) {
  return useQuery({
    queryKey: ["return-items", returnId],
    enabled: !!returnId,
    queryFn: () => returnsService.listItems(returnId!),
  });
}

export function useReturnActions(returnId: string | undefined) {
  return useQuery({
    queryKey: ["return-actions", returnId],
    enabled: !!returnId,
    queryFn: () => returnsService.listActions(returnId!),
  });
}

export function useReturnEvidence(returnId: string | undefined) {
  return useQuery({
    queryKey: ["return-evidence", returnId],
    enabled: !!returnId,
    queryFn: () => returnsService.listEvidence(returnId!),
  });
}

export function useQuarantine(status: QuarantineStatus = "em_quarentena") {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["quarantine", companyId, status],
    enabled: !!companyId,
    queryFn: () => returnsService.listQuarantine(companyId!, status),
  });
}

export function useCreateReturn() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (input: Parameters<typeof returnsService.create>[0]) =>
      returnsService.create({ ...input, companyId: input.companyId || companyId! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      toast({ title: "Devolução criada" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateReturnStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (p: { returnId: string; status: ReturnStatus }) =>
      returnsService.updateStatus(p.returnId, p.status, companyId!),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["return", v.returnId] });
      qc.invalidateQueries({ queryKey: ["return-actions", v.returnId] });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });
}

export function useBipReturnItem() {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (p: { returnId: string; code: string }) =>
      returnsService.bipItem(p.returnId, p.code, companyId!),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["return-items", v.returnId] });
    },
  });
}

export function useProcessItemDecision() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (p: {
      returnItemId: string;
      returnId: string;
      condition: ItemCondition;
      quantity: number;
      notes?: string;
    }) => returnsService.processItemDecision({ ...p, companyId: companyId! }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["return-items", v.returnId] });
      qc.invalidateQueries({ queryKey: ["return-actions", v.returnId] });
      qc.invalidateQueries({ queryKey: ["quarantine"] });
      toast({ title: "Item processado" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useReleaseQuarantine() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (p: { quarantineId: string; destination: "estoque" | "descarte"; notes?: string }) =>
      returnsService.releaseQuarantine({ ...p, companyId: companyId! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quarantine"] });
      toast({ title: "Quarentena atualizada" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useUploadReturnEvidence() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: (p: { returnId: string; returnItemId?: string; file: File; caption?: string }) =>
      returnsService.uploadEvidence({ ...p, companyId: companyId! }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["return-evidence", v.returnId] });
      toast({ title: "Evidência anexada" });
    },
    onError: (e: any) =>
      toast({ title: "Erro upload", description: e.message, variant: "destructive" }),
  });
}
