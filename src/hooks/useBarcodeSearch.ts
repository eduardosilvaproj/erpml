
import { useState } from "react";
import { buscarPorCodigo, BarcodeSearchResult } from "@/lib/barcode-search";
import { useToast } from "@/hooks/use-toast";

export function useBarcodeSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  // This hook will be used by components to perform the search.
  // The UI for the modals can be handled by a separate component or within this hook's context.
  
  const search = async (codigo: string) => {
    setIsSearching(true);
    try {
      const result = await buscarPorCodigo(codigo);
      return result;
    } catch (error: any) {
      console.error("Erro na busca por código de barras:", error);
      toast({
        title: "Erro na busca",
        description: "Ocorreu um erro ao buscar o produto.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSearching(false);
    }
  };

  return {
    search,
    isSearching,
  };
}
