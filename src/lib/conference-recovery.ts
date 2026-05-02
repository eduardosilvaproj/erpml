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

type ConferenceIdentitySource = {
  productId?: string | null;
  sku?: string | null;
  barcode?: string | null;
  name?: string | null;
};

export const buildConferenceItemIdentity = ({ productId, sku, barcode, name }: ConferenceIdentitySource): string => {
  const normalizedSku = sku?.trim();
  const normalizedBarcode = barcode?.trim();
  const normalizedName = name?.trim();

  if (productId) return productId;
  if (normalizedSku) return `sku:${normalizedSku}`;
  if (normalizedBarcode) return `ean:${normalizedBarcode}`;
  if (normalizedName) return `name:${normalizedName}`;
  return "orphan:unknown";
};

/**
 * Busca os totais reais da conferência (sem nenhum limite) usando RPC SQL.
 * Sempre use esta função para os contadores — nunca calcule no cliente
 * a partir de uma lista paginada.
 */
export const fetchConferenceTotals = async (conferenceId: string, companyId?: string | null): Promise<ConferenceTotals> => {
  const q = supabase.rpc("get_conference_totals" as any, { conf_id: conferenceId });
  // RLS should handle it, but if explicit filter is needed:
  // if (companyId) q = q.eq("company_id", companyId); 
  // RPC calls usually don't support .eq unless they return a table.
  
  const { data, error } = await q;
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalBips: Number(row?.total_bips ?? 0),
    uniqueProducts: Number(row?.unique_products ?? 0),
  };
};

/**
 * Busca todos os registros brutos de conference_items (sem limite).
 * Use apenas quando precisar do detalhe linha-a-linha (ex: matching de bip,
 * checagem de status final). Para popular UI/contadores, prefira as RPCs.
 */
export const fetchConferenceItemsRaw = async <T = any>(
  conferenceId: string,
  select = "*",
  companyId?: string | null
): Promise<T[]> => {
  let query = supabase
    .from("conference_items")
    .select(select)
    .eq("conference_id", conferenceId);
  
  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
};

/**
 * Busca os itens da conferência já agrupados por produto (sem nenhum limite),
 * pronto para popular o estado da tela de bipagem.
 */
export const fetchConferenceItemsGrouped = async (
  conferenceId: string,
  productImagesById?: Map<string, string | null>,
  companyId?: string | null
): Promise<RestoredScannedProduct[]> => {
  const { data, error } = await supabase.rpc("get_conference_items_grouped" as any, { conf_id: conferenceId });
  if (error) throw error;

  return ((data ?? []) as any[])
    .map((row) => {
      const name = row.product_name ?? "Produto";
      const sku = row.sku ?? "";
      const barcode = row.ean ?? null;

      return {
        productId: buildConferenceItemIdentity({
          productId: row.product_id,
          sku,
          barcode,
          name,
        }),
        name,
        sku,
        barcode,
        imageUrl: row.product_id ? productImagesById?.get(row.product_id) ?? null : null,
        scannedQty: Number(row.total_qty ?? 0),
        systemQty: Number(row.expected_qty ?? 0),
        lastBipAt: row.last_scan ? new Date(row.last_scan) : new Date(),
        boxInfo: parseBoxInfo(row.detalhes_caixa as Json | null),
      };
    })
    .filter((item) => item.scannedQty > 0);
};
