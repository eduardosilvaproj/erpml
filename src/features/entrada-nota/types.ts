import { type NFeData, type MatchResult, type NFeProduct } from "@/lib/nfe-parser";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface ConferenceItem {
  xmlProduct: NFeProduct;
  matchedProductId: string | null;
  matchedProductName: string | null;
  matchedProductBarcode: string | null;
  matchedProductSku: string | null;
  matchedProductGtinCx: string | null;
  matchedProductBoxQty: number | null;
  matchType: string;
  expectedQty: number;
  scannedQty: number;
  status: "pending" | "partial" | "ok" | "excess" | "not_found";
  nfNumber?: string;
  boxBadge?: string;
}

export interface BatchNfe {
  id: string;
  nfeData: NFeData;
  matches: MatchResult[];
  fileName?: string;
  selected: boolean;
  conferenceStatus: "pending" | "in_progress" | "done";
  partialData?: boolean;
  partialReason?: string;
}

export interface SefazEntry {
  id: string;
  number: string;
  series: string;
  status: "idle" | "loading" | "found" | "error";
  error?: string;
  nfeData?: NFeData;
  matches?: MatchResult[];
}

export interface KitGroup {
  kitId: string;
  name: string;
  sku: string;
  itemIndices: number[];
  quantity: number;
  cost: number;
  price?: number;
}
