import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { WEBHOOK_CORS_HEADERS } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Webhook is public — Asaas calls it without auth
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { event, payment } = body;

    if (!event || !payment) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }

    console.log(`Asaas webhook: ${event}`, JSON.stringify({ paymentId: payment.id, status: payment.status }));

    // Log the payment event
    const companyId = payment.externalReference || null;

    if (companyId) {
      // Find subscription by asaas IDs
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .or(`asaas_payment_id.eq.${payment.id},asaas_subscription_id.eq.${payment.subscription}`)
        .eq("company_id", companyId)
        .limit(1)
        .maybeSingle();

      // Log event to new subscription_events table
      await supabase.from("subscription_events").insert({
        subscription_id: sub?.id || null,
        company_id: companyId,
        event_type: event,
        provider: 'asaas',
        external_id: payment.id,
        payload: body,
        amount: payment.value,
        status: payment.status
      });

      // Legacy payment_logs for backward compatibility
      await supabase.from("payment_logs").insert({
        subscription_id: sub?.id || null,
        company_id: companyId,
        asaas_payment_id: payment.id,
        event_type: event,
        status: payment.status,
        value: payment.value,
        payment_method: payment.billingType,
        raw_data: body,
      });

      // Update subscription status based on event
      if (sub?.id) {
        const statusMap: Record<string, string> = {
          PAYMENT_CONFIRMED: "active",
          PAYMENT_RECEIVED: "active",
          PAYMENT_OVERDUE: "overdue",
          PAYMENT_DELETED: "cancelled",
          PAYMENT_REFUNDED: "cancelled",
          PAYMENT_RESTORED: "pending",
        };

        const newStatus = statusMap[event];
        if (newStatus) {
          const updateData: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
          if (newStatus === "active") {
            updateData.paid_at = new Date().toISOString();
            // Extend expiry by 30 days
            const expires = new Date();
            expires.setDate(expires.getDate() + 30);
            updateData.expires_at = expires.toISOString();
          }
          await supabase.from("subscriptions").update(updateData).eq("id", sub.id);
        }
      }

      // If payment confirmed, ensure company plan is updated
      if (["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(event) && sub?.id) {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("plan_id")
          .eq("id", sub.id)
          .maybeSingle();

        if (subscription) {
          await supabase
            .from("companies")
            .update({ plan_id: subscription.plan_id })
            .eq("id", companyId);
        }
      }

      // If refunded/deleted, downgrade to free plan
      if (["PAYMENT_REFUNDED", "PAYMENT_DELETED"].includes(event)) {
        const { data: freePlan } = await supabase
          .from("plans")
          .select("id")
          .eq("slug", "free")
          .maybeSingle();

        if (freePlan) {
          await supabase
            .from("companies")
            .update({ plan_id: freePlan.id })
            .eq("id", companyId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...WEBHOOK_CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
