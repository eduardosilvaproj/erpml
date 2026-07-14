import { supabase } from "@/integrations/supabase/client";

export interface EnrichedProductData {
  description?: string;
  weight_kg?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  depth_cm?: number | null;
  suggested_category?: string;
  suggested_price_brl?: number | null;
}

export async function enrichProduct(params: {
  productName: string;
  ean?: string;
  ncm?: string;
  unit?: string;
}): Promise<EnrichedProductData> {
  const { data, error } = await supabase.functions.invoke("enrich-product", {
    body: params,
  });

  if (error) throw new Error(error.message || "Erro ao buscar dados do produto");
  if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
  return data.data as EnrichedProductData;
}
