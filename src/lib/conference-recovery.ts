import { supabase } from "@/integrations/supabase/client";

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
  detalhes_caixa: { boxes: number; unitsPerBox: number; totalUnits: number; gtinSaved?: boolean } | null;
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
  boxInfo?: { boxes: number; unitsPerBox: number; totalUnits: number; gtinSaved?: boolean };
}

export const createConferenceItemKey = (item: Pick<ConferenceItemRow, "id" | "product_id" | "sku" | "ean" | "nome_produto">) =>
  item.product_id ?? `orphan:${item.sku ?? item.ean ?? item.nome_produto ?? item.id}`;

export const fetchAllConferenceItems = async (conferenceId: string, logLabel = "ConferenceRecovery") => {
  const PAGE_SIZE = 5000;

  const { count, error: countError } = await supabase
    .from("conference_items")
    .select("id", { count: "exact", head: true })
    .eq("conference_id", conferenceId);

  if (countError) throw countError;

  const expectedTotal = Number(count ?? 0);
  let offset = 0;
  let batchIndex = 0;
  const allItems: ConferenceItemRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("conference_items")
      .select("*")
      .eq("conference_id", conferenceId)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const batch = (data ?? []) as ConferenceItemRow[];
    console.log(
      `[${logLabel}] lote ${batchIndex} (${offset}-${offset + PAGE_SIZE - 1}) → ${batch.length} registros`,
    );

    if (batch.length === 0) break;

    allItems.push(...batch);
    offset += batch.length;
    batchIndex += 1;

    if (expectedTotal > 0 && allItems.length >= expectedTotal) break;
  }

  console.log(
    `[${logLabel}] TOTAL retornado do banco para ${conferenceId}: ${allItems.length} de ${expectedTotal} registros`,
  );

  return { items: allItems, expectedTotal };
};

export const aggregateConferenceItems = (items: ConferenceItemRow[]) => {
  const aggregated = new Map<string, ConferenceItemRow>();

  for (const item of items) {
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