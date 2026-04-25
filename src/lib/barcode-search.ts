
import { supabase } from "@/integrations/supabase/client";

export interface BarcodeSearchResult {
  produto: any;
  tipo: 'unidade' | 'caixa';
  qty: number;
  gtin?: any;
}

export async function buscarPorCodigo(codigo: string, companyId?: string): Promise<BarcodeSearchResult | null> {
  if (!codigo) return null;

  // 1. Buscar como EAN ou SKU (são idênticos agora)
  let queryEanSku = supabase
    .from('products')
    .select('*, product_gtins(*)')
    .or(`ean.eq.${codigo},sku.eq.${codigo}`);
  
  if (companyId) queryEanSku = queryEanSku.eq('company_id', companyId);
  const { data: porEanSku } = await queryEanSku.maybeSingle();
  
  if (porEanSku) {
    return { produto: porEanSku, tipo: 'unidade', qty: 1 };
  }

  // 2. Buscar como GTIN de caixa
  let queryGtin = supabase
    .from('product_gtins')
    .select('*, product:products(*)')
    .eq('gtin', codigo);
  
  if (companyId) queryGtin = queryGtin.eq('company_id', companyId);
  const { data: porGtin } = await queryGtin.maybeSingle();
  
  if (porGtin && porGtin.product) {
    return {
      produto: porGtin.product,
      tipo: 'caixa',
      qty: porGtin.qtd_por_caixa,
      gtin: porGtin
    };
  }

  // 3. Buscar em SKUs de fornecedores
  let querySupplier = supabase
    .from('product_supplier_skus')
    .select('*, product:products(*)')
    .eq('supplier_sku', codigo);
  
  const { data: porSkuFornecedor } = await querySupplier.maybeSingle();
  
  if (porSkuFornecedor && porSkuFornecedor.product) {
    if (companyId && porSkuFornecedor.product.company_id !== companyId) {
      // Not for this company
    } else {
      return {
        produto: porSkuFornecedor.product,
        tipo: 'unidade',
        qty: 1
      };
    }
  }

  return null;
}
