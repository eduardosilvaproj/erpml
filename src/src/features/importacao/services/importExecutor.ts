import { supabase } from "@/integrations/supabase/client";
import { ImportJobRow, ImportType } from "../types/import-types";

export interface ExecutionResult {
  created: number;
  updated: number;
  failed: number;
  errors: { row: number; message: string; data?: any }[];
}

export const executeImport = async (
  rows: Partial<ImportJobRow>[], 
  type: ImportType, 
  companyId: string,
  onProgress: (current: number, total: number) => void
): Promise<ExecutionResult> => {
  const validRows = rows.filter(r => (r.validation_errors?.length ?? 0) === 0);
  const total = validRows.length;
  let processed = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: { row: number; message: string; data?: any }[] = [];

  for (const row of validRows) {
    const data = row.mapped_data;
    const rowIndex = (row.row_index ?? 0) + 1; // 1-based for UI

    if (!data) {
      processed++;
      onProgress(processed, total);
      continue;
    }

    try {
      if (type === 'products' || type === 'products_and_stock') {
        // Find existing product by SKU or EAN within the same company
        let existingProduct = null;
        
        if (data.sku) {
          const { data: p, error: selectError } = await supabase
            .from('products')
            .select('id')
            .eq('sku', data.sku)
            .eq('company_id', companyId)
            .maybeSingle();
          
          if (selectError) throw selectError;
          existingProduct = p;
        }
        
        if (!existingProduct && data.ean) {
          const { data: p, error: selectError } = await supabase
            .from('products')
            .select('id')
            .eq('ean', data.ean)
            .eq('company_id', companyId)
            .maybeSingle();
          
          if (selectError) throw selectError;
          existingProduct = p;
        }

        const productData: any = {
          name: data.name || "Produto Importado",
          sku: data.sku || null,
          ean: data.ean || null,
          barcode: data.ean || data.sku || null,
          category_id: null,
          price: data.price || 0,
          cost: data.cost || 0,
          active: data.active ?? true,
          company_id: companyId,
          description: data.description || null,
          updated_at: new Date().toISOString()
        };

        if (existingProduct) {
          const { error: updateError } = await supabase
            .from('products')
            .update(productData)
            .eq('id', existingProduct.id)
            .eq('company_id', companyId);
          
          if (updateError) {
            console.error(`Erro ao atualizar SKU ${data.sku}:`, updateError);
            throw updateError;
          }
          
          updated++;
          
          if (type === 'products_and_stock' && data.quantity !== undefined && data.quantity !== null) {
            const { error: stockError } = await supabase
              .from('products')
              .update({ stock_physical: data.quantity })
              .eq('id', existingProduct.id)
              .eq('company_id', companyId);
            
            if (stockError) console.error("Erro ao atualizar estoque:", stockError);
          }
        } else {
          const { error: insertError } = await supabase
            .from('products')
            .insert({
              ...productData,
              stock_physical: (type === 'products_and_stock') ? (data.quantity || 0) : 0
            });
          
          if (insertError) {
            console.error(`Erro ao inserir SKU ${data.sku}:`, insertError);
            throw insertError;
          }
          created++;
        }
      } else if (type === 'stock' && data.quantity !== undefined && data.quantity !== null) {
        // Update stock only logic
        const { data: p, error: selectError } = await supabase
          .from('products')
          .select('id')
          .or(`sku.eq.${data.sku},ean.eq.${data.ean}`)
          .eq('company_id', companyId)
          .maybeSingle();
          
        if (selectError) throw selectError;

        if (p) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ 
              stock_physical: data.quantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', p.id)
            .eq('company_id', companyId);
            
          if (updateError) throw updateError;
          updated++;
        } else {
          failed++;
          errors.push({ 
            row: rowIndex, 
            message: `Produto não encontrado para atualizar estoque (SKU: ${data.sku || 'N/A'}, EAN: ${data.ean || 'N/A'})` 
          });
        }
      }
    } catch (error: any) {
      failed++;
      console.error(`Erro na linha ${rowIndex}:`, error);
      errors.push({ 
        row: rowIndex, 
        message: error.message || "Erro desconhecido ao salvar no banco",
        data: data
      });
    }

    processed++;
    onProgress(processed, total);
  }

  return { created, updated, failed, errors };
};
