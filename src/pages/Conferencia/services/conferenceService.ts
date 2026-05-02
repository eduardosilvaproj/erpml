import { supabase } from "@/integrations/supabase/client";
import type { ScannedProduct, ConferenceMode } from "../types";

export async function saveConference(
  companyId: string,
  mode: ConferenceMode,
  name: string,
  type: "full" | "section",
  sectionName: string,
  products: ScannedProduct[]
) {
  const { data, error } = await supabase
    .from("conferences")
    .insert({
      company_id: companyId,
      mode,
      name,
      type,
      section_name: type === "section" ? sectionName : null,
      status: "completed",
      total_products: products.length,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  const conferenceId = data.id;

  const items = products.map((p) => ({
    conference_id: conferenceId,
    product_id: p.productId,
    scanned_qty: p.scannedQty,
    system_qty: p.systemQty,
    difference: p.scannedQty - p.systemQty,
  }));

  const { error: itemsError } = await supabase
    .from("conference_items")
    .insert(items);

  if (itemsError) throw itemsError;

  return conferenceId;
}
