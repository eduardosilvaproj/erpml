import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useAuth } from "@/contexts/AuthContext";
import { returnsService, type CreateReturnParams } from "@/services/returns";

export function useReturns(filters?: { status?: string; search?: string }) {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["returns", companyId, filters],
    enabled: !!companyId,
    queryFn: () => returnsService.fetchReturns(companyId!, filters),
  });
}

export function useReturn(returnId: string | null) {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["return", returnId],
    enabled: !!returnId && !!companyId,
    queryFn: () => returnsService.fetchReturn(returnId!, companyId!),
  });
}

export function useReturnActions(returnId: string | null) {
  return useQuery({
    queryKey: ["return-actions", returnId],
    enabled: !!returnId,
    queryFn: () => returnsService.fetchReturnActions(returnId!),
  });
}

export function useReturnEvidence(returnId: string | null) {
  return useQuery({
    queryKey: ["return-evidence", returnId],
    enabled: !!returnId,
    queryFn: () => returnsService.fetchReturnEvidence(returnId!),
  });
}

export function useCreateReturn() {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: CreateReturnParams) =>
      returnsService.createReturn(params, companyId!, user?.id || ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
    },
  });
}

export function useUpdateReturnStatus() {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ returnId, status }: { returnId: string; status: string }) =>
      returnsService.updateReturnStatus(returnId, status, companyId!, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["return"] });
    },
  });
}

export function useClassifyItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, condition, notes }: { itemId: string; condition: string; notes?: string }) =>
      returnsService.classifyItem(itemId, condition, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["return"] });
    },
  });
}

export function useAddReturnAction() {
  const companyId = useCompanyId();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ returnId, action, description, metadata }: {
      returnId: string; action: string; description: string; metadata?: any;
    }) => returnsService.addAction(returnId, companyId!, action, description, user?.id, metadata),
  });
}

export function useAddReturnEvidence() {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: ({ returnId, ...params }: {
      returnId: string; type: string; storage_path: string; file_name?: string;
      file_size?: number; mime_type?: string; duration_seconds?: number;
      description?: string; tags?: string[];
    }) => returnsService.addEvidence(returnId, companyId!, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["return-evidence"] });
    },
  });
}

export function useQuarantineItems(filters?: { status?: string }) {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["quarantine", companyId, filters],
    enabled: !!companyId,
    queryFn: () => returnsService.fetchQuarantineItems(companyId!, filters),
  });
}

export function useReleaseQuarantine() {
  const queryClient = useQueryClient();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: (quarantineId: string) =>
      returnsService.releaseQuarantine(quarantineId, companyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quarantine"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDiscardQuarantine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quarantineId, reason }: { quarantineId: string; reason: string }) =>
      returnsService.discardQuarantine(quarantineId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quarantine"] });
    },
  });
}