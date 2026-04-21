import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type ConferenceBoxInfo = { boxes: number; unitsPerBox: number; totalUnits: number; gtinSaved?: boolean };

const parseBoxInfo = (value: Json | null): ConferenceBoxInfo | null => {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;

  const boxes = Number(value.boxes);
  const unitsPerBox = Number(value.unitsPerBox);
  const totalUnits = Number(value.totalUnits);

  if ([boxes, unitsPerBox, totalUnits].some((n) => Number.isNaN(n))) return null;

  return {
    boxes,
    unitsPerBox,
    totalUnits,
    gtinSaved: typeof value.gtinSaved === "boolean" ? value.gtinSaved : undefined,
  };
};

export interface ConferenceItemRow {
  id: string;
  conference_id: string;
  created_at: string;
  updated_at: string;
  product_id: string | null;
  nome_produto: string | null;
  sku: string | null;
  ean: string | null;
  scanned_quantity: number | string | null;
  expected_quantity: number | string | null;
  detalhes_caixa: ConferenceBoxInfo | null;
}

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

export const createConferenceItemKey = (item: Pick<ConferenceItemRow, "id" | "product_id" | "sku" | "ean" | "nome_produto">) =>
  item.product_id ?? `orphan:${item.sku ?? item.ean ?? item.nome_produto ?? item.id}`;

export const getConferenceUniqueProductsCount = (items: Array<Pick<ConferenceItemRow, "product_id">>) =>
  new Set(items.map((item) => item.product_id)).size;

export const fetchConferenceItemsInBatches = async <T = ConferenceItemRow>(
  conferenceId: string,
  select = "*",
  logLabel = "ConferenceRecovery",
) => {
  const { data, error } = await supabase
    .from("conference_items")
    .select(select)
    .eq("conference_id", conferenceId)
    .limit(10000);

  if (error) throw error;

  const uniqueItems = Array.from(
    new Map(((data ?? []) as T[]).map((item: any) => [item?.id ?? JSON.stringify(item), item])).values(),
  );

  console.log(`[${logLabel}] TOTAL retornado do banco para ${conferenceId}: ${uniqueItems.length} registros`);

  return uniqueItems;
};

export const fetchAllConferenceItems = async (conferenceId: string, logLabel = "ConferenceRecovery") => {
  const items = await fetchConferenceItemsInBatches<ConferenceItemRow>(conferenceId, "*", logLabel);

  return items.map((item) => ({
    ...item,
    detalhes_caixa: parseBoxInfo(item.detalhes_caixa as Json | null),
  }));
};

export const aggregateConferenceItems = (items: ConferenceItemRow[]) => {
  const aggregated = new Map<string, ConferenceItemRow>();
  const seenIds = new Set<string>();

  for (const item of items) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);

    const key = createConferenceItemKey(item);
    const existing = aggregated.get(key);

    if (existing) {
      existing.scanned_quantity = Number(existing.scanned_quantity || 0) + Number(item.scanned_quantity || 0);
      existing.expected_quantity = Math.max(
        Number(existing.expected_quantity || 0),
        Number(item.expected_quantity || 0),
      );
      existing.updated_at =
        new Date(existing.updated_at ?? existing.created_at ?? 0) > new Date(item.updated_at ?? item.created_at ?? 0)
          ? existing.updated_at
          : (item.updated_at ?? item.created_at);
      existing.created_at = existing.created_at ?? item.created_at;
      existing.detalhes_caixa = existing.detalhes_caixa ?? item.detalhes_caixa;
      existing.nome_produto = existing.nome_produto ?? item.nome_produto;
      existing.sku = existing.sku ?? item.sku;
      existing.ean = existing.ean ?? item.ean;
    } else {
      aggregated.set(key, { ...item });
    }
  }

  return Array.from(aggregated.values());
};

export const mapConferenceItemsToScannedProducts = (
  items: ConferenceItemRow[],
  productsById?: Map<string, { id: string; name: string; sku: string; barcode: string | null; image_url: string | null; stock_physical: number | null }>,
): RestoredScannedProduct[] =>
  aggregateConferenceItems(items).map((item) => {
    const product = item.product_id ? productsById?.get(item.product_id) : undefined;

    return {
      productId: item.product_id ?? `orphan-${item.id}`,
      name: product?.name ?? item.nome_produto ?? "Produto",
      sku: product?.sku ?? item.sku ?? "",
      barcode: product?.barcode ?? item.ean ?? null,
      imageUrl: product?.image_url ?? null,
      scannedQty: Number(item.scanned_quantity) || 0,
      systemQty: Number(product?.stock_physical ?? item.expected_quantity ?? 0),
      lastBipAt: new Date(item.updated_at ?? item.created_at ?? Date.now()),
      boxInfo: item.detalhes_caixa ?? undefined,
    };
  });