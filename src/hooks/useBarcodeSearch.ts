
import { useState } from "react";
import { buscarPorCodigo, BarcodeSearchResult } from "@/lib/barcode-search";
import { useToast } from "@/hooks/use-toast";

export function useBarcodeSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [boxDetectedOpen, setBoxDetectedOpen] = useState(false);
  const [lastCodigo, setLastCodigo] = useState("");
  const [lastResult, setLastResult] = useState<BarcodeSearchResult | null>(null);
  const { toast } = useToast();

  const handleSearch = async (codigo: string, onProductFound: (result: BarcodeSearchResult) => void) => {
    if (!codigo) return;
    
    setIsSearching(true);
    setLastCodigo(codigo);
    
    try {
      const result = await buscarPorCodigo(codigo);
      
      if (!result) {
        setNotFoundOpen(true);
        return;
      }

      if (result.tipo === 'caixa') {
        setLastResult(result);
        setBoxDetectedOpen(true);
        return;
      }

      // Found unit product
      onProductFound(result);
    } catch (error: any) {
      console.error("Erro na busca por código de barras:", error);
      toast({
        title: "Erro na busca",
        description: "Ocorreu um erro ao buscar o produto.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  return {
    handleSearch,
    isSearching,
    notFoundOpen,
    setNotFoundOpen,
    boxDetectedOpen,
    setBoxDetectedOpen,
    lastCodigo,
    lastResult,
  };
}
