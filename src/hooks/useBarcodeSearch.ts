
import { useState } from "react";
import { buscarPorCodigo, BarcodeSearchResult } from "@/lib/barcode-search";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

/**
 * Hook para gerenciar a lógica de busca por código de barras.
 * Identifica se o código é um GTIN de caixa, SKU ou EAN individual.
 * 
 * @returns Objeto com estados de modais, resultados de busca e funções de reset.
 */
export function useBarcodeSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [boxDetectedOpen, setBoxDetectedOpen] = useState(false);
  const [lastCodigo, setLastCodigo] = useState("");
  const [lastResult, setLastResult] = useState<BarcodeSearchResult | null>(null);
  const { toast } = useToast();
  const companyId = useCompanyId();

  const handleSearch = async (codigo: string, onProductFound: (result: BarcodeSearchResult) => void) => {
    if (!codigo) return;
    if (!companyId) {
      toast({ 
        title: "Empresa não identificada", 
        description: "Aguarde o carregamento do perfil ou faça login novamente.",
        variant: "destructive" 
      });
      return;
    }
    
    setIsSearching(true);
    setLastCodigo(codigo);
    
    try {
      const result = await buscarPorCodigo(codigo, companyId);

      
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
