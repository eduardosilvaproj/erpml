import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type ConferenceBoxInfo = { boxes: number; unitsPerBox: number; totalUnits: number; gtinSaved?: boolean };

const parseBoxInfo = (value: Json | null | undefined): ConferenceBoxInfo | undefined => {
  if (!value || Array.isArray(value) || typeof value !== "object") return undefined;

  const boxes = Number((value as any).boxes);
  const unitsPerBox = Number((value as any).unitsPerBox);
  const totalUnits = Number((value as any).totalUnits);

  if ([boxes, unitsPerBox, totalUnits].some((n) => Number.isNaN(n))) return undefined;

  return {
    boxes,
    unitsPerBox,
    totalUnits,
    gtinSaved: typeof (value as any).gtinSaved === "boolean" ? (value as any).gtinSaved : undefined,
  };
};

export interface RestoredScannedProduct {
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  imageUrl: string | null;
  scannedQty: number;
  systemQty: number;
  lastBipAt: Date;
  boxInfo?: ConferenceBoxInfo;
}

export interface ConferenceTotals {
  totalBips: number;
  uniqueProducts: number;
}

/**
 * Busca os totais reais da conferência (sem nenhum limite) usando RPC SQL.
 * Sempre use esta função para os contadores — nunca calcule no cliente
 * a partir de uma lista paginada.
 */
export const fetchConferenceTotals = async (conferenceId: string): Promise<ConferenceTotals> => {
  const { data, error } = await supabase.rpc("get_conference_totals" as any, { conf_id: conferenceId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalBips: Number(row?.total_bips ?? 0),
    uniqueProducts: Number(row?.unique_products ?? 0),
  };
};

/**
 * Busca os itens da conferência já agrupados por produto (sem nenhum limite),
 * pronto para popular o estado da tela de bipagem.
 */
export const fetchConferenceItemsGrouped = async (
  conferenceId: string,
  productImagesById?: Map<string, string | null>,
): Promise<RestoredScannedProduct[]> => {
  const { data, error } = await supabase.rpc("get_conference_items_grouped" as any, { conf_id: conferenceId });
  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => ({
    productId: row.product_id ?? `orphan-${row.sku ?? row.ean ?? Math.random().toString(36).slice(2)}`,
    name: row.product_name ?? "Produto",
    sku: row.sku ?? "",
    barcode: row.ean ?? null,
    imageUrl: row.product_id ? productImagesById?.get(row.product_id) ?? null : null,
    scannedQty: Number(row.total_qty ?? 0),
    systemQty: Number(row.expected_qty ?? 0),
    lastBipAt: row.last_scan ? new Date(row.last_scan) : new Date(),
    boxInfo: parseBoxInfo(row.detalhes_caixa as Json | null),
  }));
};
