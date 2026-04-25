
import { supabase } from "@/integrations/supabase/client";

export interface BarcodeSearchResult {
  produto: any;
  tipo: 'unidade' | 'caixa';
  qty: number;
  gtin?: any;
}

export async function buscarPorCodigo(codigo: string, companyId?: string): Promise<BarcodeSearchResult | null> {
  if (!codigo) return null;

  // 1. Buscar como EAN principal do produto
  let queryEan = supabase
    .from('products')
    .select('*, product_gtins(*)')
    .eq('ean', codigo);
  
  if (companyId) queryEan = queryEan.eq('company_id', companyId);
  const { data: porEan } = await queryEan.maybeSingle();
  
  if (porEan) {
    return { produto: porEan, tipo: 'unidade', qty: 1 };
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

  // 3. Buscar como SKU interno
  let querySku = supabase
    .from('products')
    .select('*')
    .eq('sku', codigo);
  
  if (companyId) querySku = querySku.eq('company_id', companyId);
  const { data: porSku } = await querySku.maybeSingle();
  
  if (porSku) {
    return { produto: porSku, tipo: 'unidade', qty: 1 };
  }

  // 4. Buscar em SKUs de fornecedores
  let querySupplier = supabase
    .from('product_supplier_skus')
    .select('*, product:products(*)')
    .eq('supplier_sku', codigo);
  
  // Note: product_supplier_skus table might not have company_id directly, but the linked product does
  const { data: porSkuFornecedor } = await querySupplier.maybeSingle();
  
  if (porSkuFornecedor && porSkuFornecedor.product) {
    // If companyId is provided, filter by it on the linked product
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

  // 5. Não encontrado
  return null;
}
