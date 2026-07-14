export type ImportType = 'products' | 'stock' | 'products_and_stock';
export type SourceFormat = 'csv' | 'xlsx' | 'pdf';
export type ImportStatus = 'draft' | 'validated' | 'processing' | 'completed' | 'completed_with_errors' | 'failed';

export interface ImportJob {
  id: string;
  company_id: string;
  created_by?: string;
  type: ImportType;
  source_format: SourceFormat;
  source_name?: string;
  source_system?: string;
  status: ImportStatus;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  ignored_rows: number;
  created_products: number;
  updated_products: number;
  updated_stock_rows: number;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface ImportJobRow {
  id: string;
  import_job_id: string;
  row_index: number;
  raw_data: any;
  normalized_data: any;
  mapped_data: any;
  validation_errors: ValidationError[];
  warnings: string[];
  action?: 'create_product' | 'update_product' | 'update_stock' | 'create_and_update_stock' | 'ignore' | 'review_required';
  match_strategy?: 'sku' | 'ean' | 'name';
  matched_product_id?: string;
  ignored: boolean;
  confidence?: number;
  created_at: string;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ColumnMapping {
  internalField: string;
  externalField: string;
}

export const MAPPABLE_FIELDS = [
  { label: 'Nome', value: 'name', required: true },
  { label: 'SKU', value: 'sku' },
  { label: 'EAN / Código de Barras', value: 'ean' },
  { label: 'Categoria', value: 'category' },
  { label: 'Marca', value: 'brand' },
  { label: 'Preço de Custo', value: 'cost' },
  { label: 'Preço de Venda', value: 'price' },
  { label: 'Quantidade em Estoque', value: 'quantity' },
  { label: 'Localização', value: 'location' },
  { label: 'Unidade', value: 'unit' },
  { label: 'Descrição', value: 'description' },
  { label: 'Ativo', value: 'active' },
];
