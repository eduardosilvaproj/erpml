import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

export interface SellerStore {
  id: string;
  company_id: string;
  slug: string;
  store_name: string;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  description: string | null;
  whatsapp: string | null;
  sale_mode: "mercadolivre" | "proprio" | "hibrido";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreProduct {
  id: string;
  store_id: string;
  product_id: string;
  custom_price: number | null;
  custom_description: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  products?: {
    id: string;
    name: string;
    price: number;
    cost: number;
    sku: string;
    barcode: string | null;
    description: string | null;
    id_ml: string | null;
    stock_physical: number;
  };
}

export interface StoreOrder {
  id: string;
  store_id: string;
  order_number: string;
  buyer_name: string;
  buyer_email: string;
  buyer_cpf: string;
  buyer_phone: string | null;
  buyer_address: Record<string, string> | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  shipping_cost: number;
  payment_method: "pix" | "cartao" | "boleto" | null;
  payment_status: "pendente" | "pago" | "cancelado" | "expirado";
  asaas_payment_id: string | null;
  asaas_customer_id: string | null;
  asaas_invoice_url: string | null;
  asaas_pix_qrcode: string | null;
  asaas_pix_copy_paste: string | null;
  asaas_bank_slip_url: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

export function useMyStore() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["my-store", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("seller_stores")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data as SellerStore | null;
    },
    enabled: !!companyId,
  });
}

export function useUpsertStore() {
  const qc = useQueryClient();
  const companyId = useCompanyId();
  return useMutation({
    mutationFn: async (store: Partial<SellerStore> & { store_name: string; slug: string }) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      const payload = { ...store, company_id: companyId };
      
      // Check if store exists
      const { data: existing } = await supabase
        .from("seller_stores")
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("seller_stores")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("seller_stores")
          .insert(payload)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-store"] });
      toast.success("Loja salva com sucesso!");
    },
    onError: (err: Error) => {
      if (err.message?.includes("duplicate key") || err.message?.includes("unique")) {
        toast.error("Este slug já está em uso. Escolha outro.");
      } else {
        toast.error(err.message || "Erro ao salvar loja");
      }
    },
  });
}

export function useStoreProducts(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-products", storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from("store_products")
        .select("*, products(id, name, price, cost, sku, barcode, description, id_ml, stock_physical)")
        .eq("store_id", storeId);
      if (error) throw error;
      return (data || []) as StoreProduct[];
    },
    enabled: !!storeId,
  });
}

export function useUpsertStoreProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: { store_id: string; product_id: string; custom_price?: number | null; custom_description?: string | null; is_visible?: boolean }) => {
      const { data, error } = await supabase
        .from("store_products")
        .upsert(product, { onConflict: "store_id,product_id" })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["store-products", vars.store_id] });
    },
  });
}

export function useStoreOrders(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-orders", storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from("store_orders")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as StoreOrder[];
    },
    enabled: !!storeId,
  });
}

// Public: fetch store by slug (no auth required)
export function usePublicStore(slug: string | undefined) {
  return useQuery({
    queryKey: ["public-store", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("seller_stores")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as SellerStore | null;
    },
    enabled: !!slug,
  });
}

export function usePublicStoreProducts(storeId: string | undefined) {
  return useQuery({
    queryKey: ["public-store-products", storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from("store_products")
        .select("*, products(id, name, price, description, id_ml, barcode)")
        .eq("store_id", storeId)
        .eq("is_visible", true);
      if (error) throw error;
      return (data || []) as StoreProduct[];
    },
    enabled: !!storeId,
  });
}

export function useCheckSlugAvailability() {
  return useMutation({
    mutationFn: async (slug: string) => {
      const { data } = await supabase
        .from("seller_stores")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      return !data;
    },
  });
}
