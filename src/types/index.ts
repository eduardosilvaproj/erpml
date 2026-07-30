import { Database, Json } from "@/integrations/supabase/types";

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  max_users: number;
  max_products: number;
  features: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  plan_id: string | null;
  status: string;
  owner_id: string | null;
  is_courtesy: boolean;
  is_test: boolean;
  created_at: string;
  updated_at: string;
  plan?: Plan;
  members_count?: number;
  owner_profile?: {
    id: string;
    full_name: string | null;
    email?: string | null;
  } | null;
}

/**
 * Common types used across the system.
 * Organized by domain.
 */

// --- UTILITY TYPES ---
export type DbRow<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type DbInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type DbUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];

// --- PRODUCT DOMAIN ---
export interface Product extends DbRow<"products"> {
  categories?: { name: string } | null;
  product_suppliers?: {
    supplier_id: string;
    cost: number;
    is_primary: boolean;
    suppliers: { id: string; name: string };
  }[];
  product_alternative_gtins?: { gtin: string }[];
  product_supplier_skus?: {
    id: string;
    supplier_name: string;
    supplier_sku: string;
  }[];
}

export type ProductWithStock = Product & {
  stock_physical: number;
  stock_full: number;
};

export interface ProductFilters {
  search?: string;
  category_id?: string;
  supplier_id?: string;
  brand?: string;
  status?: "active" | "inactive" | "all";
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  needsCorrection?: "no_sku" | "no_supplier" | "no_ean";
}

// --- ORDER / SALES DOMAIN ---
export type OrderStatus = "pendente" | "pago" | "enviado" | "cancelado" | "finalizada";

export interface Order extends DbRow<"sales"> {
  sale_items?: OrderItem[];
  customers?: Customer | null;
}

export interface OrderItem extends DbRow<"sale_items"> {
  products?: {
    id: string;
    name: string;
    sku: string;
  } | null;
}

// --- CUSTOMER DOMAIN ---
export interface Customer extends DbRow<"customers"> {}

export interface CustomerAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

// --- FINANCIAL DOMAIN ---
export type TransactionType = "receita" | "despesa";
export type PaymentMethod = "dinheiro" | "cartao_credito" | "cartao_debito" | "pix" | "boleto";

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  description: string;
  date: string;
  paymentMethod: PaymentMethod;
  company_id: string;
}

export interface Invoice extends DbRow<"invoices"> {
  invoice_payments?: InvoicePayment[];
}

export interface InvoicePayment extends DbRow<"invoice_payments"> {}

// --- CAMPAIGN DOMAIN ---
export interface Campaign extends DbRow<"campaigns"> {}
export interface CampaignItem extends DbRow<"campaign_items"> {}

// --- MERCADO LIVRE DOMAIN ---
export interface MLProduct {
  id: string;
  title: string;
  price: number;
  available_quantity: number;
  status: string;
  permalink: string;
  thumbnail: string;
}

export interface MLOrder extends DbRow<"ml_orders"> {
  ml_order_items?: (DbRow<"ml_order_items"> & {
    products?: { id: string; name: string; sku: string } | null;
  })[];
}

export interface MLSync {
  id: string;
  sync_type: string;
  status: string;
  started_at: string;
  finished_at: string;
  details: string;
}

// --- STOCK DOMAIN ---
export interface StockMovement extends DbRow<"stock_movement_logs"> {}

export interface StockAdjustment {
  productId: string;
  newQuantity: number;
  notes?: string;
}

export interface TransferOrder extends DbRow<"transfer_orders"> {
  transfer_items?: (DbRow<"transfer_items"> & {
    products?: { id: string; name: string; sku: string; barcode: string | null } | null;
  })[];
}
