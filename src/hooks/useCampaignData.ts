import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";

export function useCampaigns() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["campaigns", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCampaignItems(campaignId: string | null) {
  return useQuery({
    queryKey: ["campaign_items", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from("campaign_items")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ name, company_id: companyId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campanha criada!" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao criar campanha", description: e.message, variant: "destructive" });
    },
  });
}

export function useAddCampaignItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, items }: { campaignId: string; items: { product_name: string; price: number; quantity: number }[] }) => {
      const rows = items.map((item) => ({
        campaign_id: campaignId,
        product_name: item.product_name,
        price: item.price,
        quantity: item.quantity,
      }));
      const { data, error } = await supabase.from("campaign_items").insert(rows).select();
      if (error) throw error;

      await supabase
        .from("campaigns")
        .update({ total_items: items.length })
        .eq("id", campaignId);

      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["campaign_items", vars.campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useUpdateCampaignItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase.from("campaign_items").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign_items"] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase.from("campaigns").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campanha atualizada!" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campanha excluída!" });
    },
  });
}

export function useCampaignTemplates() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ["campaign_templates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();

  return useMutation({
    mutationFn: async (data: { name: string; description_prompt: string }) => {
      const { error } = await supabase
        .from("campaign_templates")
        .insert({ ...data, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign_templates"] });
      toast({ title: "Template salvo!" });
    },
  });
}

export async function enrichCampaignItem(productName: string, templatePrompt?: string) {
  const { data, error } = await supabase.functions.invoke("campaign-ai", {
    body: { action: "enrich_item", productName, templatePrompt },
  });
  if (error) throw new Error(error.message || "Erro ao enriquecer item");
  if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
  return { enriched: data.data, tokens: data.tokens_used || 0 };
}
