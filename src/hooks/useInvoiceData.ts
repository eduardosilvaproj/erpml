// Stub — legacy hook. Real invoice logic lives in entrada-nota feature.
export const useInvoiceStats = () => ({ data: null, isLoading: false });
export const useInvoices = () => ({ data: [], isLoading: false });
export const useImportInvoice = () => ({
  mutate: (_args?: any) => {},
  mutateAsync: async (_args?: any) => ({ createdCount: 0, updatedCount: 0, pendingCount: 0, skippedCount: 0 }),
  isPending: false,
});
