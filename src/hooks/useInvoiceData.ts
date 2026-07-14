// Stub — legacy hook. Real invoice logic lives in entrada-nota feature.
export const useInvoiceStats = () => ({ data: null, isLoading: false });
export const useInvoices = () => ({ data: [], isLoading: false });
export const useImportInvoice = () => ({ mutate: () => {}, mutateAsync: async () => {}, isPending: false });
