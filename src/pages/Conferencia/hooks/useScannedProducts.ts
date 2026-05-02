import { useState, useCallback } from "react";
import type { ScannedProduct } from "../types";

export function useScannedProducts() {
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);

  const addProduct = useCallback((product: ScannedProduct) => {
    setScannedProducts((prev) => {
      const existing = prev.find((p) => p.productId === product.productId);
      if (existing) {
        return prev.map((p) =>
          p.productId === product.productId
            ? { ...p, scannedQty: p.scannedQty + product.scannedQty }
            : p
        );
      }
      return [...prev, product];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, qty: number) => {
    setScannedProducts((prev) =>
      prev.map((p) => (p.productId === productId ? { ...p, scannedQty: qty } : p))
    );
  }, []);

  const removeProduct = useCallback((productId: string) => {
    setScannedProducts((prev) => prev.filter((p) => p.productId !== productId));
  }, []);

  const clearAll = useCallback(() => {
    setScannedProducts([]);
  }, []);

  return {
    scannedProducts,
    setScannedProducts,
    addProduct,
    updateQuantity,
    removeProduct,
    clearAll,
  };
}
