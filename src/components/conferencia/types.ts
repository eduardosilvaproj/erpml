export type ConferenceMode = "nf" | "inventario" | null;
export type ConferenceType = "full" | "partial";

export interface ScannedProduct {
  productId: string;
  name: string;
  sku: string;
  scannedQty: number;
  systemQty: number;
  barcode?: string | null;
  imageUrl?: string | null;
  lastBipAt?: Date;
  boxInfo?: {
    boxes: number;
    unitsPerBox: number;
    totalUnits: number;
    gtinSaved?: boolean;
  };
}

export interface ConferenceResults {
  ok: ScannedProduct[];
  divergent: ScannedProduct[];
  notFound: ScannedProduct[];
}
