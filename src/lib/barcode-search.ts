
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

  // 1. PRIORIDADE MÁXIMA: EAN (ou barcode) do produto (Unidade)
  let queryEan = supabase
    .from('products')
    .select('*, product_gtins(*)')
    .or(`ean.eq."${trimmed}",barcode.eq."${trimmed}"`);
  
  if (companyId) queryEan = queryEan.eq('company_id', companyId);
  const { data: porEan } = await queryEan.maybeSingle();
  
  if (porEan) {
    return { produto: porEan, tipo: 'unidade', qty: 1 };
  }

  // 2. FALLBACK 1: GTIN de Caixa (gtin_cx) cadastrado no produto
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
      qty: porGtinCx.box_quantity || 12
    };
  }

  // 3. FALLBACK 2: GTIN na tabela de GTINs extras (product_gtins)
  let queryGtinTable = supabase
    .from('product_gtins')
    .select('*, product:products(*)')
    .eq('gtin', trimmed);
  
  if (companyId) queryGtinTable = queryGtinTable.eq('company_id', companyId);
  const { data: porGtinTable } = await queryGtinTable.maybeSingle();
  
  if (porGtinTable && porGtinTable.product) {
    return {
      produto: porGtinTable.product,
      tipo: porGtinTable.tipo === 'caixa' ? 'caixa' : 'unidade',
      qty: porGtinTable.box_quantity || 1,
      gtin: porGtinTable
    };
  }

  // 4. Último caso: SKUs de fornecedores (apenas se configurado)
  const querySupplier = supabase
    .from('product_supplier_skus')
    .select('*, product:products(*)')
    .eq('supplier_sku', trimmed);
  
  const { data: porSkuFornecedor } = await querySupplier.maybeSingle();
  
  if (porSkuFornecedor && porSkuFornecedor.product) {
    if (companyId && porSkuFornecedor.product.company_id !== companyId) {
      return null;
    }
    return {
      produto: porSkuFornecedor.product,
      tipo: 'unidade',
      qty: 1
    };
  }

  return null;
}
