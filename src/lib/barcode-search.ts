
import { supabase } from "@/integrations/supabase/client";

export interface BarcodeSearchResult {
  produto: any;
  tipo: 'unidade' | 'caixa';
  qty: number;
  gtin?: any;
}

export interface KitSearchResult {
  tipo: 'kit';
  kit: any;
  itens: any[];
}

export type BuscaResultado = BarcodeSearchResult | KitSearchResult;

export async function buscarPorCodigo(codigo: string, companyId: string): Promise<BarcodeSearchResult | KitSearchResult | null> {
  if (!companyId) throw new Error("companyId é obrigatório");
  if (!codigo) return null;
  const trimmed = codigo.trim().toUpperCase();

  // PRIORIDADE 1: Item dentro de kit
  const kitItemResult = await buscarItemEmKit(trimmed, companyId);
  if (kitItemResult) {
    return kitItemResult;
  }

  // PRIORIDADE 2: EAN/barcode do produto (Unidade)
  const { data: porEan } = await supabase
    .from('products')
    .select('*, product_gtins(*)')
    .or(`ean.ilike.%${trimmed}%,barcode.ilike.%${trimmed}%`)
    .eq('company_id', companyId)
    .maybeSingle();

  if (porEan) {
    return { produto: porEan, tipo: 'unidade', qty: 1 };
  }

  // PRIORIDADE 3: GTIN de Caixa (gtin_cx) cadastrado no produto
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

  // PRIORIDADE 4: GTIN na tabela de GTINs extras (product_gtins)
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

  // PRIORIDADE 5: EAN Genérico (product_alternative_gtins)
  const { data: porAltGtin } = await supabase
    .from('product_alternative_gtins')
    .select('*, product:products(*)')
    .eq('gtin', trimmed)
    .eq('company_id', companyId)
    .maybeSingle();

  if (porAltGtin && (porAltGtin as any).product) {
    return {
      produto: (porAltGtin as any).product,
      tipo: 'unidade',
      qty: 1,
      gtin: porAltGtin
    };
  }

  // PRIORIDADE 6: SKUs de fornecedores
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

  // PRIORIDADE 7: Kit pelo EAN ou SKU do kit
  const { data: porKitEan } = await supabase
    .from('product_kits')
    .select('*, kit_items(product:products(*))')
    .eq('company_id', companyId)
    .or(`ean.ilike.%${trimmed}%,sku.ilike.%${trimmed}%`)
    .maybeSingle();

  if (porKitEan) {
    return { tipo: 'kit', kit: porKitEan, itens: porKitEan.kit_items || [] };
  }

  return null;
}

/** Busca se o código pertence a um item dentro de algum kit */
async function buscarItemEmKit(codigo: string, companyId: string): Promise<BarcodeSearchResult | null> {
  // Primeiro busca o produto
  const { data: produto } = await supabase
    .from('products')
    .select('*, product_gtins(*)')
    .or(`ean.ilike.%${codigo}%,barcode.ilike.%${codigo}%`)
    .eq('company_id', companyId)
    .maybeSingle();

  if (!produto) {
    // Tenta GTIN alternativo
    const { data: gtinAlt } = await supabase
      .from('product_alternative_gtins')
      .select('product_id')
      .eq('gtin', codigo)
      .eq('company_id', companyId)
      .maybeSingle();

    if (gtinAlt) {
      const { data: prodByGtin } = await supabase
        .from('products')
        .select('*, product_gtins(*)')
        .eq('id', gtinAlt.product_id)
        .eq('company_id', companyId)
        .maybeSingle();
      if (prodByGtin) {
        const kitInfo = await encontrarKitDoProduto(prodByGtin.id, companyId);
        if (kitInfo) {
          return { produto: prodByGtin, tipo: 'unidade', qty: 1, gtin: { isKitItem: true, kitInfo } };
        }
      }
    }
    return null;
  }

  const kitInfo = await encontrarKitDoProduto(produto.id, companyId);
  if (kitInfo) {
    return { produto, tipo: 'unidade', qty: 1, gtin: { isKitItem: true, kitInfo } };
  }

  return null;
}

/** Encontra se um produto está em algum kit */
async function encontrarKitDoProduto(productId: string, companyId: string): Promise<any | null> {
  const { data: kitItem } = await supabase
    .from('kit_items')
    .select('*, kit:product_kits!inner(id, name, sku, ean, company_id)')
    .eq('product_id', productId)
    .eq('kit.company_id', companyId)
    .maybeSingle();

  if (kitItem?.kit) {
    return {
      kitId: kitItem.kit.id,
      kitName: kitItem.kit.name,
      kitSku: kitItem.kit.sku,
      kitEan: kitItem.kit.ean,
      quantidadeNoKit: kitItem.quantity
    };
  }
  return null;
}
