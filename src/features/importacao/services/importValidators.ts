import { ImportJobRow, ColumnMapping, ValidationError, ImportType } from "../types/import-types";
import { normalizeString, normalizeNumber, normalizeBoolean } from "./importNormalizer";

export const validateRows = (
  rawRows: any[], 
  mappings: ColumnMapping[], 
  type: ImportType
): Partial<ImportJobRow>[] => {
  return rawRows.map((raw, index) => {
    const errors: ValidationError[] = [];
    const mapped: any = {};
    
    mappings.forEach(m => {
      const val = raw[m.externalField];
      
      switch (m.internalField) {
        case 'name':
          mapped.name = normalizeString(val);
          if (!mapped.name) errors.push({ field: 'name', message: 'Nome é obrigatório', severity: 'error' });
          break;
        case 'sku':
          mapped.sku = normalizeString(val);
          break;
        case 'ean':
          mapped.ean = normalizeString(val);
          break;
        case 'cost':
          mapped.cost = normalizeNumber(val);
          break;
        case 'price':
          mapped.price = normalizeNumber(val);
          break;
        case 'quantity':
          mapped.quantity = normalizeNumber(val);
          break;
        case 'active':
          mapped.active = normalizeBoolean(val);
          break;
        default:
          mapped[m.internalField] = normalizeString(val);
      }
    });

    // Logical cross-validation
    if (type === 'products' || type === 'products_and_stock') {
      if (!mapped.sku && !mapped.ean) {
        errors.push({ field: 'sku', message: 'É necessário SKU ou EAN para identificar o produto', severity: 'error' });
      }
    }

    if (type === 'stock' || type === 'products_and_stock') {
      if (mapped.quantity === null) {
        errors.push({ field: 'quantity', message: 'Quantidade é obrigatória para importação de estoque', severity: 'error' });
      }
    }

    return {
      row_index: index,
      raw_data: raw,
      mapped_data: mapped,
      validation_errors: errors,
      ignored: false
    };
  });
};
