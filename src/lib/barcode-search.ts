
import { supabase } from "@/integrations/supabase/client";

export interface BarcodeSearchResult {
  produto: any;
  tipo: 'unidade' | 'caixa';
  qty: number;
  gtin?: any;
}

export async function buscarPorCodigo(codigo: string, companyId: string): Promise<BarcodeSearchResult | null> {
  if (!companyId) throw new Error("companyId é obrigatório");
  if (!codigo) return null;
  const trimmed = codigo.trim();

  // 1. PRIORIDADE MÁXIMA: EAN (ou barcode) do produto (Unidade)
  const { data: porEan } = await supabase
    .from('products')
    .select('*, product_gtins(*)')
    .or(`ean.eq."${trimmed}",barcode.eq."${trimmed}"`)
    .eq('company_id', companyId)
    .maybeSingle();
  
  if (porEan) {
    return { produto: porEan, tipo: 'unidade', qty: 1 };
  }

  // 2. FALLBACK 1: GTIN de Caixa (gtin_cx) cadastrado no produto
  const { data: porGtinCx } = await supabase
    .from('products')
    .select('*, product_gtins(*)')
    .eq('gtin_cx', trimmed)
    .eq('company_id', companyId)
    .maybeSingle();

  if (porGtinCx) {
    return {
      produto: porGtinCx,
      tipo: 'caixa',
      qty: porGtinCx.box_quantity || 12
    };
  }

  // 3. FALLBACK 2: GTIN na tabela de GTINs extras (product_gtins)
  const { data: porGtinTable } = await supabase
    .from('product_gtins')
    .select('*, product:products(*)')
    .eq('gtin', trimmed)
    .eq('company_id', companyId)
    .maybeSingle();
  
  if (porGtinTable && porGtinTable.product) {
    return {
      produto: porGtinTable.product,
      tipo: porGtinTable.tipo === 'caixa' ? 'caixa' : 'unidade',
      qty: porGtinTable.box_quantity || 1,
      gtin: porGtinTable
    };
  }

  // 4. Último caso: SKUs de fornecedores (apenas se configurado)
  const { data: porSkuFornecedor } = await supabase
    .from('product_supplier_skus')
    .select('*, product:products(*)')
    .eq('supplier_sku', trimmed)
    .eq('company_id', companyId)
    .maybeSingle();
  
  if (porSkuFornecedor && porSkuFornecedor.product) {
    return {
      produto: porSkuFornecedor.product,
      tipo: 'unidade',
      qty: 1
    };
  }

  return null;
}
