import { ColumnMapping } from "../types/import-types";
import { normalizeHeader } from "../services/importNormalizer";

const aliases: Record<string, string[]> = {
  name: ['nome', 'produto', 'descricao', 'item', 'title', 'name', 'product'],
  sku: ['codigo', 'cod', 'sku', 'ref', 'referencia', 'internal_code'],
  ean: ['ean', 'gtin', 'codigo_de_barras', 'cod_barras', 'barcode'],
  category: ['categoria', 'cat', 'category', 'grupo', 'depto'],
  brand: ['marca', 'brand', 'fabricante'],
  cost: ['custo', 'preco_custo', 'valor_custo', 'cost_price', 'price_cost'],
  price: ['preco', 'valor_venda', 'preco_venda', 'price', 'selling_price'],
  quantity: ['qtd', 'quantidade', 'estoque', 'stock', 'quantity', 'saldo'],
  location: ['local', 'localizacao', 'location', 'posicao'],
  unit: ['unidade', 'un', 'unit', 'medida'],
  description: ['desc', 'detalhes', 'observacoes', 'description'],
  active: ['ativo', 'status', 'active', 'habilitado']
};

export const suggestMapping = (headers: string[]): ColumnMapping[] => {
  if (!headers || headers.length === 0) return [];
  
  const mapping: ColumnMapping[] = [];
  const mappedInternalFields = new Set<string>();
  const mappedExternalFields = new Set<string>();
  
  // Normalizamos todos os cabeçalhos primeiro
  const normalizedHeaders = headers.map(h => ({
    original: h,
    normalized: normalizeHeader(h)
  }));

  // Ordem de prioridade para campos internos (importante!)
  const internalFieldsPriority = [
    'name', 'sku', 'ean', 'price', 'cost', 'quantity', 
    'category', 'brand', 'unit', 'active', 'description', 'location'
  ];

  for (const internalField of internalFieldsPriority) {
    const fieldAliases = aliases[internalField];
    if (!fieldAliases) continue;

    // Tenta encontrar a melhor correspondência para este campo interno
    for (const h of normalizedHeaders) {
      if (mappedExternalFields.has(h.original)) continue;

      if (fieldAliases.includes(h.normalized)) {
        mapping.push({ internalField, externalField: h.original });
        mappedInternalFields.add(internalField);
        mappedExternalFields.add(h.original);
        break; // Achou uma correspondência para este campo interno, pula para o próximo
      }
    }
  }
  
  return mapping;
};
