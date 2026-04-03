import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface ConferenceItem {
  id: string;
  conference_id: string;
  invoice_item_id: string;
  product_id: string | null;
  expected_quantity: number;
  scanned_quantity: number;
  status: string;
  invoice_items?: {
    xml_code: string;
    xml_description: string;
    quantity: number;
    unit_value: number;
    products?: { id: string; name: string; sku: string; barcode: string | null } | null;
  };
}

export interface Conference {
  id: string;
  invoice_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  created_at: string;
  company_id: string | null;
  invoices?: { id: string; number: string; series: string | null; issuer_name: string | null; items_count: number };
  conference_items?: ConferenceItem[];
}

export function useConferences(filters?: { status?: string; dateFrom?: string; dateTo?: string }) {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["conferences", filters, companyId],
    queryFn: async () => {
      let query = supabase
        .from("conferences")
        .select("*, invoices(id, number, series, issuer_name, items_count), conference_items(*, invoice_items(xml_code, xml_description, quantity, unit_value, products(id, name, sku, barcode)))")
        .order("created_at", { ascending: false });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo + "T23:59:59");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Conference[];
    },
  });
}

export function usePendingInvoices() {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["pending-invoices-for-conference", companyId],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, invoice_items(*, products(id, name, sku, barcode))")
        .eq("status", "aguardando_conferencia")
        .order("created_at", { ascending: false });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useStartConference() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data: items, error: itemsErr } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId);
      if (itemsErr) throw itemsErr;

      const { data: conf, error: confErr } = await supabase
        .from("conferences")
        .insert({ invoice_id: invoiceId, status: "em_andamento", company_id: companyId })
        .select()
        .single();
      if (confErr) throw confErr;

      const confItems = items.map((item) => ({
        conference_id: conf.id,
        invoice_item_id: item.id,
        product_id: item.product_id,
        expected_quantity: item.quantity,
        scanned_quantity: 0,
        status: "pendente",
      }));

      const { error: ciErr } = await supabase.from("conference_items").insert(confItems);
      if (ciErr) throw ciErr;

      return conf;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      queryClient.invalidateQueries({ queryKey: ["pending-invoices-for-conference"] });
      toast({ title: "Conferência iniciada!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao iniciar conferência", description: error.message, variant: "destructive" });
    },
  });
}

export function useScanItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conferenceId, barcode }: { conferenceId: string; barcode: string }) => {
      const { data: confItems, error } = await supabase
        .from("conference_items")
        .select("*, invoice_items(xml_code, xml_description, products(id, name, sku, barcode))")
        .eq("conference_id", conferenceId);
      if (error) throw error;

      const matched = (confItems as unknown as ConferenceItem[]).find((ci) => {
        const prod = ci.invoice_items?.products;
        if (!prod) return false;
        return prod.barcode === barcode || prod.sku === barcode;
      });

      const matchByCode = !matched
        ? (confItems as unknown as ConferenceItem[]).find((ci) => ci.invoice_items?.xml_code === barcode)
        : null;

      const target = matched || matchByCode;
      if (!target) {
        throw new Error(`Produto com código "${barcode}" não encontrado nesta nota fiscal.`);
      }

      const newQty = target.scanned_quantity + 1;
      let newStatus = "pendente";
      if (newQty === target.expected_quantity) newStatus = "ok";
      else if (newQty > target.expected_quantity) newStatus = "excedente";

      const { error: updateErr } = await supabase
        .from("conference_items")
        .update({ scanned_quantity: newQty, status: newStatus })
        .eq("id", target.id);
      if (updateErr) throw updateErr;

      return { itemId: target.id, newQty, expected: target.expected_quantity, status: newStatus, productName: target.invoice_items?.xml_description };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
    },
  });
}

export function useFinishConference() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (conferenceId: string) => {
      const { data: items, error } = await supabase
        .from("conference_items")
        .select("*")
        .eq("conference_id", conferenceId);
      if (error) throw error;

      const allOk = items.every((i) => i.status === "ok");
      const finalStatus = allOk ? "conferida" : "divergente";

      await supabase
        .from("conferences")
        .update({ status: finalStatus, finished_at: new Date().toISOString() })
        .eq("id", conferenceId);

      const { data: conf } = await supabase
        .from("conferences")
        .select("invoice_id")
        .eq("id", conferenceId)
        .single();

      if (conf) {
        await supabase
          .from("invoices")
          .update({ status: finalStatus })
          .eq("id", conf.invoice_id);
      }

      return { status: finalStatus, allOk };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      queryClient.invalidateQueries({ queryKey: ["pending-invoices-for-conference"] });
      toast({
        title: result.allOk ? "Conferência concluída com sucesso!" : "Conferência finalizada com divergências",
        variant: result.allOk ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao finalizar", description: error.message, variant: "destructive" });
    },
  });
}
