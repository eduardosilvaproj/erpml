import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useAuth } from "@/contexts/AuthContext";

export type ConferenceTipo = "inventario" | "nota_fiscal";
export type ConferenceStatus =
  | "em_andamento"
  | "pausada"
  | "conferida"
  | "divergente"
  | "concluida"
  | "cancelada";

export interface ConferenceRow {
  id: string;
  company_id: string | null;
  tipo: ConferenceTipo;
  nome: string | null;
  status: ConferenceStatus;
  invoice_id: string | null;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
  created_at: string;
  criado_por: string | null;
  atualizado_por: string | null;
  notes: string | null;
}

export interface ConferenceItemRow {
  id: string;
  conference_id: string;
  product_id: string | null;
  invoice_item_id: string | null;
  nome_produto: string | null;
  sku: string | null;
  ean: string | null;
  expected_quantity: number;
  scanned_quantity: number;
  status: string;
  tipo_contagem: "unidade" | "caixa";
  detalhes_caixa: any;
  atualizado_por: string | null;
  updated_at: string;
  created_at: string;
}

/** Lista conferências (filtro por status/tipo) — usada para "em andamento" e histórico. */
export function useConferenceHistory(filters?: {
  status?: ConferenceStatus | "em_andamento_pausada" | "all";
  tipo?: ConferenceTipo | "all";
  limit?: number;
}) {
  const companyId = useCompanyId();

  return useQuery({
    queryKey: ["conferences-history", filters, companyId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("conferences")
        .select("*")
        .eq("company_id", companyId!)
        .order("updated_at", { ascending: false });

      if (filters?.status && filters.status !== "all") {
        if (filters.status === "em_andamento_pausada") {
          q = q.in("status", ["em_andamento", "pausada"]);
        } else {
          q = q.eq("status", filters.status);
        }
      }
      if (filters?.tipo && filters.tipo !== "all") {
        q = q.eq("tipo", filters.tipo);
      }
      if (filters?.limit) q = q.limit(filters.limit);

      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as ConferenceRow[];
    },
  });
}

/** Busca uma conferência + itens. */
export function useConferenceDetail(conferenceId: string | null) {
  return useQuery({
    queryKey: ["conference-detail", conferenceId],
    enabled: !!conferenceId,
    queryFn: async () => {
      const { data: conf, error } = await supabase
        .from("conferences")
        .select("*")
        .eq("id", conferenceId!)
        .single();
      if (error) throw error;

      const { data: items, error: e2 } = await supabase
        .from("conference_items")
        .select("*")
        .eq("conference_id", conferenceId!)
        .order("created_at", { ascending: true });
      if (e2) throw e2;

      return { conference: conf as unknown as ConferenceRow, items: (items ?? []) as unknown as ConferenceItemRow[] };
    },
  });
}

/** Cria nova conferência (inventário ou nota fiscal). */
export function useCreateConference() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const companyId = useCompanyId();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { tipo: ConferenceTipo; nome: string; invoice_id?: string | null }) => {
      const { data, error } = await supabase
        .from("conferences")
        .insert({
          company_id: companyId,
          tipo: input.tipo,
          nome: input.nome,
          invoice_id: input.invoice_id ?? null,
          status: "em_andamento",
          criado_por: user?.id,
          atualizado_por: user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ConferenceRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conferences-history"] });
      toast({ title: "Conferência iniciada" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao iniciar conferência", description: e.message, variant: "destructive" }),
  });
}

/** Salva uma bipagem (cria ou incrementa item). */
export function useSaveScan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      conferenceId: string;
      product: { id?: string | null; nome?: string | null; sku?: string | null; ean?: string | null; estoque?: number };
      quantidade: number;
      tipo_contagem?: "unidade" | "caixa";
      detalhes_caixa?: any;
    }) => {
      const { conferenceId, product, quantidade, tipo_contagem = "unidade", detalhes_caixa = null } = input;

      let existing: any = null;
      if (product.id) {
        const { data } = await supabase
          .from("conference_items")
          .select("*")
          .eq("conference_id", conferenceId)
          .eq("product_id", product.id)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        const newQty = Number(existing.scanned_quantity) + quantidade;
        const expected = Number(existing.expected_quantity || 0);
        let status = "pendente";
        if (expected > 0) {
          if (newQty === expected) status = "ok";
          else if (newQty > expected) status = "excedente";
        } else {
          status = "ok";
        }
        const { error } = await supabase
          .from("conference_items")
          .update({
            scanned_quantity: newQty,
            status,
            tipo_contagem,
            detalhes_caixa,
            atualizado_por: user?.id,
          } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("conference_items").insert({
          conference_id: conferenceId,
          product_id: product.id ?? null,
          nome_produto: product.nome ?? null,
          sku: product.sku ?? null,
          ean: product.ean ?? null,
          expected_quantity: product.estoque ?? 0,
          scanned_quantity: quantidade,
          status: "ok",
          tipo_contagem,
          detalhes_caixa,
          atualizado_por: user?.id,
        } as any);
        if (error) throw error;
      }

      // Bump updated_at
      await supabase
        .from("conferences")
        .update({ atualizado_por: user?.id, updated_at: new Date().toISOString() } as any)
        .eq("id", conferenceId);

      return true;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["conference-detail", vars.conferenceId] });
      queryClient.invalidateQueries({ queryKey: ["conferences-history"] });
    },
  });
}

/** Pausar / retomar / cancelar / concluir conferência. */
export function useUpdateConferenceStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { id: string; status: ConferenceStatus }) => {
      const patch: any = { status: input.status, atualizado_por: user?.id };
      if (input.status === "concluida" || input.status === "conferida" || input.status === "divergente") {
        patch.finished_at = new Date().toISOString();
      }
      const { error } = await supabase.from("conferences").update(patch).eq("id", input.id);
      if (error) throw error;
      return true;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["conferences-history"] });
      queryClient.invalidateQueries({ queryKey: ["conference-detail", vars.id] });
      toast({ title: "Status atualizado" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao atualizar status", description: e.message, variant: "destructive" }),
  });
}

/** Realtime: escuta mudanças nos itens da conferência ativa. */
export function useConferenceRealtime(conferenceId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conferenceId) return;
    const channel = supabase
      .channel(`conference-rt-${conferenceId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conference_items", filter: `conference_id=eq.${conferenceId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conference-detail", conferenceId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conferences", filter: `id=eq.${conferenceId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conference-detail", conferenceId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conferenceId, queryClient]);
}
