
import { supabase } from "@/integrations/supabase/client";

export interface BarcodeSearchResult {
  produto: any;
  tipo: 'unidade' | 'caixa';
  qty: number;
  gtin?: any;
}

export async function buscarPorCodigo(codigo: string): Promise<BarcodeSearchResult | null> {
  if (!codigo) return null;

  // 1. Buscar como EAN principal do produto
  const { data: porEan } = await supabase
    .from('products')
    .select('*, product_gtins(*)')
    .eq('ean', codigo)
    .maybeSingle();
  
  if (porEan) {
    return { produto: porEan, tipo: 'unidade', qty: 1 };
  }

  // 2. Buscar como GTIN de caixa
  const { data: porGtin } = await supabase
    .from('product_gtins')
    .select('*, product:products(*)')
    .eq('gtin', codigo)
    .maybeSingle();
  
  if (porGtin) {
    return {
      produto: porGtin.product,
      tipo: 'caixa',
      qty: porGtin.qtd_por_caixa,
      gtin: porGtin
    };
  }

  // 3. Buscar como SKU interno
  const { data: porSku } = await supabase
    .from('products')
    .select('*')
    .eq('sku', codigo)
    .maybeSingle();
  
  if (porSku) {
    return { produto: porSku, tipo: 'unidade', qty: 1 };
  }

  // 4. Buscar em SKUs de fornecedores
  const { data: porSkuFornecedor } = await supabase
    .from('product_supplier_skus')
    .select('*, product:products(*)')
    .eq('supplier_sku', codigo)
    .maybeSingle();
  
  if (porSkuFornecedor) {
    return {
      produto: porSkuFornecedor.product,
      tipo: 'unidade',
      qty: 1
    };
  }

  // 5. Não encontrado
  return null;
}
