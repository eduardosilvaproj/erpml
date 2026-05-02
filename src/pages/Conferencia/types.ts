export type ConferenceMode = "nf" | "inventario";
export type ConferenceType = "full" | "section";
export type Step = 1 | 2 | 3;

export interface ScannedProduct {
  productId: string;
  name: string;
  sku: string;
  ean: string;
  scannedQty: number;
  systemQty: number;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  ean: string;
  barcode: string;
  stock: number;
  price: number;
  gtin_cx?: string;
  box_quantity?: number;
}

export interface BarcodeSearchResult {
  produto: Product;
  qty: number;
  isBox: boolean;
}
