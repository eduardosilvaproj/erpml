
import { supabase } from "@/integrations/supabase/client";

export interface BarcodeSearchResult {
  produto: any;
  tipo: 'unidade' | 'caixa';
  qty: number;
  gtin?: any;
}

export async function buscarPorCodigo(codigo: string, companyId?: string): Promise<BarcodeSearchResult | null> {
  if (!codigo) return null;
  const trimmed = codigo.trim();

  // 1. Primeiro busca em products onde ean = código bipado (produto unitário)
  let queryEan = supabase
    .from('products')
    .select('*, product_gtins(*)')
    .eq('ean', trimmed);
  
  if (companyId) queryEan = queryEan.eq('company_id', companyId);
  const { data: porEan } = await queryEan.maybeSingle();
  
  if (porEan) {
    return { produto: porEan, tipo: 'unidade', qty: 1 };
  }

  // 2. Se não achar, busca em products onde gtin_cx = código bipado (caixa conhecida)
  let queryGtinCx = supabase
    .from('products')
    .select('*, product_gtins(*)')
    .eq('gtin_cx', trimmed);
  
  if (companyId) queryGtinCx = queryGtinCx.eq('company_id', companyId);
  const { data: porGtinCx } = await queryGtinCx.maybeSingle();

  if (porGtinCx) {
    return {
      produto: porGtinCx,
      tipo: 'caixa',
      qty: porGtinCx.box_quantity || 12 // Usa box_quantity do produto
    };
  }

  // 3. Buscar como GTIN de caixa na tabela específica (legado/detalhado)
  let queryGtinTable = supabase
    .from('product_gtins')
    .select('*, product:products(*)')
    .eq('gtin', trimmed);
  
  if (companyId) queryGtinTable = queryGtinTable.eq('company_id', companyId);
  const { data: porGtinTable } = await queryGtinTable.maybeSingle();
  
  if (porGtinTable && porGtinTable.product) {
    return {
      produto: porGtinTable.product,
      tipo: 'caixa',
      qty: porGtinTable.box_quantity,
      gtin: porGtinTable
    };
  }

  // 4. Buscar em SKUs de fornecedores
  let querySupplier = supabase
    .from('product_supplier_skus')
    .select('*, product:products(*)')
    .eq('supplier_sku', trimmed);
  
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
