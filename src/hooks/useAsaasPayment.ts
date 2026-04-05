import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateCustomerParams {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
}

interface CreateSubscriptionParams {
  customerId: string;
  planSlug: string;
  billingType: "BOLETO" | "CREDIT_CARD" | "PIX";
  companyId: string;
}

export function useAsaasPayment() {
  const [loading, setLoading] = useState(false);

  const createCustomer = async (params: CreateCustomerParams) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-payment", {
        body: { action: "create-customer", ...params },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.customerId as string;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar cliente";
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createSubscription = async (params: CreateSubscriptionParams) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-payment", {
        body: { action: "create-subscription", ...params },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { subscriptionId: string; invoiceUrl: string | null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar assinatura";
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createPayment = async (params: CreateSubscriptionParams) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-payment", {
        body: { action: "create-payment", ...params },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        paymentId: string;
        invoiceUrl: string | null;
        bankSlipUrl: string | null;
        pixQrCode: string | null;
        pixCopyPaste: string | null;
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao gerar cobrança";
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createCustomer, createSubscription, createPayment, loading };
}
