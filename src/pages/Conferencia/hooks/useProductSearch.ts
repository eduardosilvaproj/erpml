import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Product, BarcodeSearchResult } from "../types";

export function useProductSearch(companyId: string | undefined) {
  const [isSearching, setIsSearching] = useState(false);

  const searchProduct = useCallback(
    async (code: string): Promise<BarcodeSearchResult | null> => {
      if (!companyId || !code) return null;

      setIsSearching(true);
      try {
        const trimmed = code.trim();

        const { data: products, error } = await supabase
          .from("products")
          .select("*")
          .eq("company_id", companyId)
          .or(`ean.eq.${trimmed},barcode.eq.${trimmed}`);

        if (error) throw error;

        if (products && products.length > 0) {
          const product = products[0] as Product;
          return { produto: product, qty: 1, isBox: false };
        }

        const { data: boxProducts, error: boxError } = await supabase
          .from("products")
          .select("*")
          .eq("company_id", companyId)
          .eq("gtin_cx", trimmed);

        if (boxError) throw boxError;

        if (boxProducts && boxProducts.length > 0) {
          const product = boxProducts[0] as Product;
          const qty = product.box_quantity || 1;
          return { produto: product, qty, isBox: true };
        }

        return null;
      } finally {
        setIsSearching(false);
      }
    },
    [companyId]
  );

  return { searchProduct, isSearching };
}
