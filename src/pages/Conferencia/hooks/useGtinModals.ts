import { useState } from "react";
import type { Product } from "../types";

interface GtinModalState {
  notFoundOpen: boolean;
  boxDetectedOpen: boolean;
  lastCodigo: string;
  lastResult: { produto: Product; qty: number } | null;
}

export function useGtinModals() {
  const [state, setState] = useState<GtinModalState>({
    notFoundOpen: false,
    boxDetectedOpen: false,
    lastCodigo: "",
    lastResult: null,
  });

  const showNotFound = (codigo: string) => {
    setState({
      notFoundOpen: true,
      boxDetectedOpen: false,
      lastCodigo: codigo,
      lastResult: null,
    });
  };

  const showBoxDetected = (codigo: string, produto: Product, qty: number) => {
    setState({
      notFoundOpen: false,
      boxDetectedOpen: true,
      lastCodigo: codigo,
      lastResult: { produto, qty },
    });
  };

  const closeAll = () => {
    setState({
      notFoundOpen: false,
      boxDetectedOpen: false,
      lastCodigo: "",
      lastResult: null,
    });
  };

  return {
    ...state,
    showNotFound,
    showBoxDetected,
    closeAll,
    setNotFoundOpen: (open: boolean) => setState((s) => ({ ...s, notFoundOpen: open })),
    setBoxDetectedOpen: (open: boolean) => setState((s) => ({ ...s, boxDetectedOpen: open })),
  };
}
